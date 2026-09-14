import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { enviarAcessoConecta } from "@/lib/resend/emails";

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
const APP_URL = "https://sistemagestaogenezi.vercel.app";

// Endpoint SEPARADO do webhook financeiro (src/app/api/webhooks/asaas/route.ts,
// REGRA da tarefa) — Gênezi Conecta cobra por assinatura recorrente, não por
// parcela avulsa, e afeta perfis_conecta, não parcelas/matriculas. Payload de
// evento de pagamento vem em payment.subscription (id da assinatura); payload
// de evento de ciclo de vida da assinatura (SUBSCRIPTION_DELETED etc.) vem
// direto em subscription.id, sem objeto payment.
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

// Best-effort de verdade: nunca deve impedir a ativação do perfil (que já
// aconteceu com sucesso antes desta chamada) — qualquer falha aqui (Resend
// não configurado, generateLink com erro, e-mail sem match) só é
// engolida. O candidato nunca soube a senha temporária gerada no cadastro
// (REGRA da tarefa) — este link de recovery é a única forma dele criar a
// própria senha e conseguir entrar em /entrar depois.
//
// O link enviado por email é construído a partir de hashed_token, NÃO do
// action_link cru devolvido por generateLink: action_link aponta pro
// endpoint hospedado do próprio Supabase (auth/v1/verify), que verifica o
// token e redireciona de volta com os tokens de sessão no FRAGMENTO da URL
// (#access_token=...) — invisível pro nosso /auth/callback, que é um Route
// Handler server-side (nunca recebe fragmento). Construindo o link direto
// pro nosso /auth/callback com token_hash+type na query string, o
// verifyOtp de lá funciona de verdade — mesmo padrão que o próprio Supabase
// documenta pra quem envia o email de recovery por conta própria (não pelo
// SMTP integrado dele).
async function enviarLinkAcessoConecta(
  supabase: ReturnType<typeof createAdminClient>,
  perfil: { nome: string | null; email: string | null; plano: string | null },
): Promise<void> {
  if (!perfil.email) return;

  try {
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: perfil.email,
      options: { redirectTo: `${APP_URL}/conecta/criar-senha` },
    });

    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) return;

    const recoveryLink = `${APP_URL}/auth/callback?token_hash=${hashedToken}&type=recovery`;

    await enviarAcessoConecta(perfil.email, perfil.nome ?? "candidato", recoveryLink, perfil.plano ?? "—");
  } catch {
    // Best-effort — ver comentário acima.
  }
}

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
        .select("nome, email, plano")
        .maybeSingle();

      if (error) return "Não foi possível ativar o perfil do candidato.";

      // Best-effort — a ativação já aconteceu com sucesso acima.
      if (perfil) {
        try {
          await dispararEvento(
            "conecta.pagamento.confirmado",
            { nome: perfil.nome ?? "—", plano: perfil.plano ?? "—" },
            `conecta-pagamento-confirmado-${subscriptionId}`,
          );
        } catch {
          // Best-effort — ver comentário acima.
        }

        await enviarLinkAcessoConecta(supabase, perfil);
      }

      return null;
    }
    case "PAYMENT_OVERDUE": {
      const subscriptionId = payload.payment?.subscription;
      if (!subscriptionId) return null;

      // Não zera visivel — 3 dias de graça antes de ocultar (REGRA da
      // tarefa), só desativa esta_ativo.
      const { error } = await supabase
        .from("perfis_conecta")
        .update({ esta_ativo: false })
        .eq("asaas_subscription_id", subscriptionId);

      return error ? "Não foi possível marcar o perfil como inativo." : null;
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

      // Best-effort — o cancelamento já aconteceu com sucesso acima.
      if (perfil) {
        try {
          await dispararEvento(
            "conecta.assinatura.cancelada",
            { nome: perfil.nome ?? "—", plano: perfil.plano ?? "—" },
            `conecta-assinatura-cancelada-${subscriptionId}`,
          );
        } catch {
          // Best-effort — ver comentário acima.
        }
      }

      return null;
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
