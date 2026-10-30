import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { enviarAcessoConectaCandidato } from "@/lib/conecta/acesso";
import { notificarEmpresaPagamentoConfirmado, notificarNovoCandidatoTelegram } from "@/lib/conecta/telegram";
import { enviarPagamentoConfirmadoEmpresa } from "@/lib/resend/emails";

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";

// Endpoint SEPARADO do webhook financeiro (src/app/api/webhooks/asaas/route.ts,
// REGRA da tarefa) — Gênezi Conecta cobra por assinatura recorrente, não por
// parcela avulsa, e afeta perfis_conecta (candidatos) E empresas_conecta
// (empresas, TAREFA: assinatura anual). Payload de evento de pagamento vem em
// payment.subscription (id da assinatura); payload de evento de ciclo de vida
// da assinatura (SUBSCRIPTION_DELETED etc.) vem direto em subscription.id, sem
// objeto payment.
//
// asaas_subscription_id não colide entre as duas tabelas (cada assinatura no Asaas só pode
// pertencer a UM customer, que ou é candidato ou é empresa) — por isso processarEvento tenta
// perfis_conecta primeiro e só verifica empresas_conecta se não achar ali, nunca os dois.
type AsaasConectaWebhookPayload = {
  id?: string;
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    status: string;
  };
  subscription?: {
    id: string;
    status: string;
  };
};

async function processarEvento(
  supabase: ReturnType<typeof createAdminClient>,
  payload: AsaasConectaWebhookPayload,
): Promise<string | null> {
  switch (payload.event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED": {
      const subscriptionId = payload.payment?.subscription;
      if (!subscriptionId) return null;

      const { data: perfil, error } = await supabase
        .from("perfis_conecta")
        .update({ esta_ativo: true, visivel: true })
        .eq("asaas_subscription_id", subscriptionId)
        .select("nome, email, whatsapp, plano, cidade, estado")
        .maybeSingle();

      if (error) return "Não foi possível ativar o perfil do candidato.";

      if (perfil) {
        // Best-effort — a ativação já aconteceu com sucesso acima.
        try {
          await dispararEvento(
            "conecta.pagamento.confirmado",
            { nome: perfil.nome ?? "—", plano: perfil.plano ?? "—" },
            `conecta-pagamento-confirmado-${subscriptionId}`,
          );
        } catch {
          // Best-effort — ver comentário acima.
        }

        // Notificação Telegram do CONECTA (chat dedicado, ver src/lib/conecta/telegram.ts) —
        // complementar à de dispararEvento acima, que vai pro Telegram GERAL da escola via
        // notificarConectaPagamentoConfirmado (handlers/telegram.ts), com um texto diferente.
        await notificarNovoCandidatoTelegram({
          nome: perfil.nome ?? "—",
          tipo: "externo",
          cidade: perfil.cidade,
          estado: perfil.estado,
        });

        // Email + WhatsApp de acesso (link de criação de senha) — o retorno NÃO bloqueia a
        // ativação (que já aconteceu com sucesso acima), mas o erro é propagado pro log
        // (log_webhooks_conecta.erro) em vez de engolido em silêncio: foi exatamente esse
        // silêncio que escondeu o incidente original (candidato pago sem receber acesso).
        const resultadoAcesso = await enviarAcessoConectaCandidato(perfil);
        return resultadoAcesso.erro;
      }

      // Não achou em perfis_conecta — tenta empresas_conecta (TAREFA: assinatura anual da
      // empresa). assinatura_vencimento = hoje + 1 ano (ciclo YEARLY, ver
      // criarAssinaturaConecta em empresa/cadastro/actions.ts).
      const vencimento = new Date();
      vencimento.setFullYear(vencimento.getFullYear() + 1);

      const { data: empresa, error: erroEmpresa } = await supabase
        .from("empresas_conecta")
        .update({ assinatura_status: "ativa", assinatura_vencimento: vencimento.toISOString() })
        .eq("asaas_subscription_id", subscriptionId)
        .select("nome_empresa, email, cidade")
        .maybeSingle();

      if (erroEmpresa) return "Não foi possível ativar a assinatura da empresa.";
      if (!empresa) return "Nenhum perfil ou empresa encontrado para esta assinatura (asaas_subscription_id sem match).";

      await notificarEmpresaPagamentoConfirmado({ nome: empresa.nome_empresa, cidade: empresa.cidade });
      await enviarPagamentoConfirmadoEmpresa(empresa.email, empresa.nome_empresa);
      return null;
    }
    case "PAYMENT_OVERDUE": {
      const subscriptionId = payload.payment?.subscription;
      if (!subscriptionId) return null;

      // Não zera visivel — 3 dias de graça antes de ocultar (REGRA da
      // tarefa), só desativa esta_ativo.
      const { data: perfil, error } = await supabase
        .from("perfis_conecta")
        .update({ esta_ativo: false })
        .eq("asaas_subscription_id", subscriptionId)
        .select("id")
        .maybeSingle();

      if (error) return "Não foi possível marcar o perfil como inativo.";
      if (perfil) return null;

      const { error: erroEmpresa } = await supabase
        .from("empresas_conecta")
        .update({ assinatura_status: "inativa" })
        .eq("asaas_subscription_id", subscriptionId);

      return erroEmpresa ? "Não foi possível marcar a assinatura da empresa como inativa." : null;
    }
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED": {
      const subscriptionId = payload.subscription?.id;
      if (!subscriptionId) return null;

      const { data: perfil, error } = await supabase
        .from("perfis_conecta")
        .update({ esta_ativo: false, visivel: false })
        .eq("asaas_subscription_id", subscriptionId)
        .select("nome, plano")
        .maybeSingle();

      if (error) return "Não foi possível cancelar o perfil do candidato.";

      if (perfil) {
        // Best-effort — o cancelamento já aconteceu com sucesso acima.
        try {
          await dispararEvento(
            "conecta.assinatura.cancelada",
            { nome: perfil.nome ?? "—", plano: perfil.plano ?? "—" },
            `conecta-assinatura-cancelada-${subscriptionId}`,
          );
        } catch {
          // Best-effort — ver comentário acima.
        }
        return null;
      }

      const { error: erroEmpresa } = await supabase
        .from("empresas_conecta")
        .update({ assinatura_status: "cancelada" })
        .eq("asaas_subscription_id", subscriptionId);

      return erroEmpresa ? "Não foi possível cancelar a assinatura da empresa." : null;
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

  const payload = (await request.json().catch(() => null)) as AsaasConectaWebhookPayload | null;
  if (!payload?.event) {
    return new Response("OK", { status: 200 });
  }

  const supabase = createAdminClient();

  // Idempotência: mesmo padrão do webhook financeiro (ver route.ts).
  const asaasEventId =
    payload.id ??
    `${payload.event}:${payload.payment?.id ?? payload.subscription?.id ?? "sem-id"}`;

  const { data: jaProcessado } = await supabase
    .from("log_webhooks_conecta")
    .select("id")
    .eq("asaas_event_id", asaasEventId)
    .maybeSingle();

  if (jaProcessado) {
    return new Response("OK", { status: 200 });
  }

  const { data: logCriado } = await supabase
    .from("log_webhooks_conecta")
    .insert({
      evento: payload.event,
      asaas_event_id: asaasEventId,
      asaas_payment_id: payload.payment?.id ?? null,
      asaas_subscription_id: payload.payment?.subscription ?? payload.subscription?.id ?? null,
      payload,
      processado: false,
    })
    .select("id")
    .single();

  const erro = await processarEvento(supabase, payload);

  if (logCriado) {
    await supabase
      .from("log_webhooks_conecta")
      .update({ processado: !erro, erro: erro ?? null })
      .eq("id", logCriado.id);
  }

  return new Response("OK", { status: 200 });
}
