import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";

type AsaasWebhookPayload = {
  id?: string;
  event: string;
  payment?: {
    id: string;
    status: string;
    value?: number;
    dueDate?: string;
  };
};

// Mapeamento evento -> atualização da parcela local. Eventos de assinatura e
// checkout ainda não têm efeito nenhum no sistema (fluxo de cobrança avulsa
// por parcela, não assinatura recorrente) — só ficam logados pra auditoria e
// uso futuro.
const EVENTOS_SEM_ACAO = new Set([
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
  "CHECKOUT_PAID",
]);

async function processarEvento(
  supabase: ReturnType<typeof createAdminClient>,
  payload: AsaasWebhookPayload,
): Promise<string | null> {
  if (EVENTOS_SEM_ACAO.has(payload.event)) {
    return null;
  }

  const paymentId = payload.payment?.id;
  if (!paymentId) {
    return "Payload sem payment.id.";
  }

  switch (payload.event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED": {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString().slice(0, 10),
          asaas_status: payload.payment?.status ?? null,
        })
        .eq("asaas_payment_id", paymentId);

      if (!error) {
        // Best-effort: motor de automações nunca lança exceção, mas o
        // try/catch aqui é uma segunda camada de proteção — o webhook
        // precisa sempre responder 200 pro Asaas, mesmo se algo inesperado
        // acontecer nessa notificação.
        try {
          const { data: parcela } = await supabase
            .from("parcelas")
            .select(
              "valor, numero_parcela, matriculas(num_parcelas, alunos(full_name), turmas(cursos(nome)))",
            )
            .eq("asaas_payment_id", paymentId)
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
              `pagamento-recebido-${paymentId}`,
            );
          }
        } catch {
          // Notificação é secundária — a atualização da parcela já
          // aconteceu com sucesso acima, é isso que importa pro webhook.
        }
      }

      return error ? "Não foi possível atualizar a parcela para paga." : null;
    }
    case "PAYMENT_OVERDUE": {
      const { error } = await supabase
        .from("parcelas")
        .update({ status: "atrasado", asaas_status: "OVERDUE" })
        .eq("asaas_payment_id", paymentId);
      return error ? "Não foi possível atualizar a parcela para atrasada." : null;
    }
    case "PAYMENT_DELETED": {
      const { error } = await supabase
        .from("parcelas")
        .update({ status: "cancelado", asaas_status: payload.payment?.status ?? null })
        .eq("asaas_payment_id", paymentId);
      return error ? "Não foi possível cancelar a parcela." : null;
    }
    case "PAYMENT_REFUNDED": {
      const { error } = await supabase
        .from("parcelas")
        .update({ status: "estornado", asaas_status: payload.payment?.status ?? null })
        .eq("asaas_payment_id", paymentId);
      return error ? "Não foi possível estornar a parcela." : null;
    }
    case "PAYMENT_UPDATED": {
      const update: Record<string, unknown> = { asaas_status: payload.payment?.status ?? null };
      if (payload.payment?.value !== undefined) update.valor = payload.payment.value;
      if (payload.payment?.dueDate) update.data_vencimento = payload.payment.dueDate;
      const { error } = await supabase
        .from("parcelas")
        .update(update)
        .eq("asaas_payment_id", paymentId);
      return error ? "Não foi possível atualizar a parcela." : null;
    }
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!token || token !== ASAAS_WEBHOOK_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AsaasWebhookPayload | null;
  if (!payload?.event) {
    return new Response("OK", { status: 200 });
  }

  const supabase = createAdminClient();

  // Idempotência: Asaas pode reenviar a mesma notificação — evento+pagamento
  // identifica a notificação de forma estável (o payload nem sempre traz um
  // "id" de evento próprio).
  const asaasEventId = payload.id ?? `${payload.event}:${payload.payment?.id ?? "sem-payment"}`;

  const { data: jaProcessado } = await supabase
    .from("log_webhooks_asaas")
    .select("id")
    .eq("asaas_event_id", asaasEventId)
    .maybeSingle();

  if (jaProcessado) {
    return new Response("OK", { status: 200 });
  }

  const { data: logCriado } = await supabase
    .from("log_webhooks_asaas")
    .insert({
      evento: payload.event,
      asaas_event_id: asaasEventId,
      asaas_payment_id: payload.payment?.id ?? null,
      payload,
      processado: false,
    })
    .select("id")
    .single();

  const erro = await processarEvento(supabase, payload);

  if (logCriado) {
    await supabase
      .from("log_webhooks_asaas")
      .update({ processado: !erro, erro: erro ?? null })
      .eq("id", logCriado.id);
  }

  return new Response("OK", { status: 200 });
}
