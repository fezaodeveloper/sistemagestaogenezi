import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { agoraEmBrasilia } from "@/lib/datas/util";
import { StripeAdapter, STRIPE_METADATA_REFERENCIA } from "@/lib/gateways/adapters/stripe";
import { carregarConfigGateway } from "@/lib/gateways/config";
import { montarConfigStripe } from "@/lib/gateways/manager";
import { GatewayTipo } from "@/lib/gateways/types";

// Webhook do Stripe — mesma lógica do webhook do Asaas (api/webhooks/asaas),
// trocando a chave de ligação: lá a parcela é achada por asaas_payment_id; aqui o
// PaymentIntent leva o id da parcela em metadata.referencia_externa (gravado por
// StripeAdapter.gerarCobranca), então não é preciso coluna nova em `parcelas`.
//
// Autenticação: assinatura do Stripe (header "stripe-signature") conferida com o
// webhookSecret salvo em /admin/configuracoes/gateways.
//
// Respostas: 400 = assinatura inválida/webhook não configurado (o Stripe não
// reenvia); 500 = falha ao gravar (o Stripe reenvia por até 3 dias, e cada
// atualização abaixo é idempotente); 200 = processado ou evento ignorado.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = ReturnType<typeof createAdminClient>;

function formatarDataHora(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function pagamentoSucedeu(supabase: Supabase, adapter: StripeAdapter, intent: Stripe.PaymentIntent, parcelaId: string): Promise<string | null> {
  const metodo = await adapter.metodoDoPaymentIntent(intent);

  // .neq("status","pago"): reenvio do mesmo evento (ou pagamento já baixado à mão)
  // não regrava a data nem reenvia a notificação.
  const { data, error } = await supabase
    .from("parcelas")
    .update({
      status: "pago",
      data_pagamento: agoraEmBrasilia().hoje,
      ...(metodo ? { forma_pagamento: metodo } : {}),
    })
    .eq("id", parcelaId)
    .neq("status", "pago")
    .select("id");

  if (error) return "Não foi possível atualizar a parcela para paga.";
  if (!data?.length) return null;

  // Best-effort, como no Asaas: a parcela já foi atualizada, a notificação é secundária.
  try {
    const { data: parcela } = await supabase
      .from("parcelas")
      .select("valor, numero_parcela, matriculas(num_parcelas, alunos(full_name), turmas(cursos(nome)))")
      .eq("id", parcelaId)
      .single();

    const detalhes = parcela as unknown as {
      valor: number;
      numero_parcela: number;
      matriculas: {
        num_parcelas: number | null;
        alunos: { full_name: string | null } | null;
        turmas: { cursos: { nome: string } | null } | null;
      } | null;
    } | null;

    if (detalhes) {
      await dispararEvento(
        "pagamento.recebido",
        {
          valor: detalhes.valor,
          nome_aluno: detalhes.matriculas?.alunos?.full_name ?? "—",
          nome_curso: detalhes.matriculas?.turmas?.cursos?.nome ?? "—",
          numero_parcela: detalhes.numero_parcela,
          total_parcelas: detalhes.matriculas?.num_parcelas ?? "—",
        },
        `pagamento-recebido-${intent.id}`,
      );
    }
  } catch {
    // Ver comentário acima.
  }
  return null;
}

// "Falhou": a tabela parcelas não tem um status "falhou" (só pendente, pago,
// atrasado, cancelado, estornado) e uma tentativa recusada não encerra a parcela
// — o pagador pode tentar de novo no mesmo link. Então a parcela continua como
// está e a falha fica ANEXADA em `observacoes` (sem apagar o que o admin escreveu).
async function pagamentoFalhou(supabase: Supabase, intent: Stripe.PaymentIntent, parcelaId: string): Promise<string | null> {
  const motivo = intent.last_payment_error?.message ?? intent.last_payment_error?.code ?? "motivo não informado";
  const registro = `[Stripe ${formatarDataHora()}] Tentativa de pagamento falhou: ${motivo}`;

  const { data: parcela, error: erroLeitura } = await supabase
    .from("parcelas")
    .select("status, observacoes")
    .eq("id", parcelaId)
    .maybeSingle();
  if (erroLeitura) return "Não foi possível ler a parcela.";
  if (!parcela || parcela.status === "pago" || parcela.status === "cancelado") return null;

  const observacoes = parcela.observacoes ? `${parcela.observacoes}\n${registro}` : registro;
  const { error } = await supabase.from("parcelas").update({ observacoes }).eq("id", parcelaId);
  return error ? "Não foi possível registrar a falha na parcela." : null;
}

async function pagamentoCancelado(supabase: Supabase, parcelaId: string): Promise<string | null> {
  // Só cancela parcela ainda em aberto — um cancelamento tardio nunca desfaz uma parcela já paga.
  const { error } = await supabase
    .from("parcelas")
    .update({ status: "cancelado" })
    .eq("id", parcelaId)
    .in("status", ["pendente", "atrasado"]);
  return error ? "Não foi possível cancelar a parcela." : null;
}

async function processarEvento(supabase: Supabase, adapter: StripeAdapter, evento: Stripe.Event): Promise<string | null> {
  if (
    evento.type !== "payment_intent.succeeded" &&
    evento.type !== "payment_intent.payment_failed" &&
    evento.type !== "payment_intent.canceled"
  ) {
    return null;
  }

  const intent = evento.data.object;
  const parcelaId = intent.metadata?.[STRIPE_METADATA_REFERENCIA];
  // Cobrança do Stripe que não nasceu de uma parcela (ou de outro sistema na mesma conta).
  if (!parcelaId || !UUID.test(parcelaId)) return null;

  switch (evento.type) {
    case "payment_intent.succeeded":
      return pagamentoSucedeu(supabase, adapter, intent, parcelaId);
    case "payment_intent.payment_failed":
      return pagamentoFalhou(supabase, intent, parcelaId);
    case "payment_intent.canceled":
      return pagamentoCancelado(supabase, parcelaId);
  }
}

export async function POST(request: Request) {
  const assinatura = request.headers.get("stripe-signature");
  if (!assinatura) return new Response("Missing signature", { status: 400 });

  // Corpo BRUTO: a assinatura é calculada sobre os bytes exatos — parsear o JSON antes quebraria.
  const corpo = await request.text();

  const config = await carregarConfigGateway(GatewayTipo.Stripe);
  const adapter = new StripeAdapter(montarConfigStripe(config));

  let evento: Stripe.Event;
  try {
    evento = adapter.verificarWebhook(corpo, assinatura);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const erro = await processarEvento(createAdminClient(), adapter, evento);
  if (erro) {
    console.error(`[stripe-webhook] ${evento.type} (${evento.id}): ${erro}`);
    return new Response("Erro ao processar", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
