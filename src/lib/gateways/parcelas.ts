import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { agoraEmBrasilia } from "@/lib/datas/util";
import type { MetodoPagamento } from "@/lib/gateways/types";
import { dispararWebhookDeParcela } from "@/lib/webhooks/payloads";
import { notificarSmsPagamentoRecebido } from "@/lib/integrax/notificacoes";
import { emitirNotaAutomatica } from "@/lib/spedy/nfe";
import { dispararFluxosPorGatilho } from "@/lib/whatsapp/fluxos";

// Atualizações de `parcelas` disparadas pelos webhooks dos gateways (Stripe,
// Pagar.me). Espelham o que o webhook do Asaas faz, mas achando a parcela pelo id
// gravado na referência do pedido/pagamento (em vez de asaas_payment_id) — assim
// não é preciso uma coluna por gateway em `parcelas`.
//
// Todas são idempotentes (o gateway pode reenviar o mesmo evento) e devolvem uma
// mensagem de erro ou null; quem chama decide a resposta HTTP.

export type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Primeiro candidato que for um uuid (id de parcela). Gateways devolvem a
// referência em lugares diferentes do payload.
export function primeiroUuid(candidatos: unknown[]): string | null {
  for (const candidato of candidatos) {
    if (typeof candidato === "string" && UUID.test(candidato)) return candidato;
  }
  return null;
}

function formatarDataHora(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Pagamento confirmado -> parcela "pago". .neq("status","pago"): reenvio do mesmo
// evento (ou parcela já baixada à mão) não regrava a data nem reenvia a notificação.
export async function baixarParcelaPaga(
  supabase: SupabaseAdmin,
  parcelaId: string,
  opcoes: { forma?: MetodoPagamento; idNotificacao: string; gateway?: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .update({
      status: "pago",
      data_pagamento: agoraEmBrasilia().hoje,
      ...(opcoes.forma ? { forma_pagamento: opcoes.forma } : {}),
    })
    .eq("id", parcelaId)
    .neq("status", "pago")
    .select("id");

  if (error) return "Não foi possível atualizar a parcela para paga.";
  if (!data?.length) return null;

  // Webhook de saída (Apps > Webhooks). Só aqui — quando a parcela de fato virou
  // paga agora —, então um reenvio do gateway não dispara de novo.
  dispararWebhookDeParcela("pedido_pago", parcelaId, opcoes.gateway ? { gateway: opcoes.gateway } : {});
  notificarSmsPagamentoRecebido(parcelaId);
  // Nota fiscal automática (Spedy) — só se houver integração ativa pro curso; roda
  // depois da resposta e uma falha aqui NUNCA afeta a confirmação do pagamento.
  emitirNotaAutomatica(parcelaId);

  // Best-effort, como no Asaas: a parcela já foi atualizada, a notificação é secundária.
  try {
    const { data: parcela } = await supabase
      .from("parcelas")
      .select("valor, numero_parcela, matriculas(num_parcelas, aluno_id, alunos(full_name, telefone), turmas(cursos(nome)))")
      .eq("id", parcelaId)
      .single();

    const detalhes = parcela as unknown as {
      valor: number;
      numero_parcela: number;
      matriculas: {
        num_parcelas: number | null;
        aluno_id: string | null;
        alunos: { full_name: string | null; telefone: string | null } | null;
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
        `pagamento-recebido-${opcoes.idNotificacao}`,
      );

      // GênZap Fase 3 — fluxos personalizados com gatilho "pagamento_recebido" (não há template
      // automático de WhatsApp pra este evento hoje, só o de SMS — os fluxos são independentes).
      const telefone = detalhes.matriculas?.alunos?.telefone;
      if (telefone && detalhes.matriculas?.aluno_id) {
        await dispararFluxosPorGatilho(
          "pagamento_recebido",
          {
            telefone,
            nome: detalhes.matriculas.alunos?.full_name ?? "aluno(a)",
            valor: `R$ ${Number(detalhes.valor).toFixed(2).replace(".", ",")}`,
            curso: detalhes.matriculas?.turmas?.cursos?.nome ?? "",
          },
          { tipo: "aluno", id: detalhes.matriculas.aluno_id },
        );
      }
    }
  } catch {
    // Ver comentário acima.
  }
  return null;
}

// "Falhou": a tabela parcelas não tem um status "falhou" (só pendente, pago,
// atrasado, cancelado, estornado) e uma tentativa recusada não encerra a parcela
// — o pagador pode tentar de novo. Então a parcela continua como está e a falha
// fica ANEXADA em `observacoes` (sem apagar o que o admin escreveu).
export async function anotarFalhaParcela(
  supabase: SupabaseAdmin,
  parcelaId: string,
  origem: string,
  motivo: string,
): Promise<string | null> {
  const registro = `[${origem} ${formatarDataHora()}] Tentativa de pagamento falhou: ${motivo}`;

  const { data: parcela, error: erroLeitura } = await supabase
    .from("parcelas")
    .select("status, observacoes")
    .eq("id", parcelaId)
    .maybeSingle();
  if (erroLeitura) return "Não foi possível ler a parcela.";
  if (!parcela || parcela.status === "pago" || parcela.status === "cancelado") return null;

  const observacoes = parcela.observacoes ? `${parcela.observacoes}\n${registro}` : registro;
  const { error } = await supabase.from("parcelas").update({ observacoes }).eq("id", parcelaId);
  if (error) return "Não foi possível registrar a falha na parcela.";

  dispararWebhookDeParcela("pagamento_recusado", parcelaId, { gateway: origem, motivo });
  return null;
}

// Só cancela parcela ainda em aberto — um cancelamento tardio nunca desfaz uma parcela já paga.
export async function cancelarParcelaEmAberto(
  supabase: SupabaseAdmin,
  parcelaId: string,
  gateway?: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .update({ status: "cancelado" })
    .eq("id", parcelaId)
    .in("status", ["pendente", "atrasado"])
    .select("id");
  if (error) return "Não foi possível cancelar a parcela.";
  if (data?.length) dispararWebhookDeParcela("pedido_cancelado", parcelaId, gateway ? { gateway } : {});
  return null;
}

// Estorno de uma parcela já paga (mesmo efeito do PAYMENT_REFUNDED do Asaas).
export async function estornarParcelaPaga(supabase: SupabaseAdmin, parcelaId: string): Promise<string | null> {
  const { error } = await supabase.from("parcelas").update({ status: "estornado" }).eq("id", parcelaId).eq("status", "pago");
  return error ? "Não foi possível estornar a parcela." : null;
}
