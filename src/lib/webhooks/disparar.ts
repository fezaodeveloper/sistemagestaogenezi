import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";
import { validarUrlWebhook, type WebhookEvento } from "@/lib/webhooks/eventos";

// Webhooks de SAÍDA: avisa as URLs cadastradas em /admin/configuracoes/apps/webhooks
// quando um evento do sistema acontece.
//
// dispararWebhook() nunca bloqueia nem quebra o fluxo que o chamou: agenda o envio
// com after() (roda depois da resposta ao usuário, e a Vercel mantém a função viva
// até terminar) e engole qualquer erro. Cada envio tem até 3 tentativas com 5s de
// intervalo — então uma função com limite de duração curto (plano Hobby) pode
// cortar as tentativas 2 e 3; o log mostra em quantas o envio chegou.
//
// Roda com o client ADMIN (service_role): quem dispara é webhook de gateway,
// formulário público ou cron, sem sessão de usuário.

const TENTATIVAS_MAXIMAS = 3;
const INTERVALO_ENTRE_TENTATIVAS_MS = 5_000;
const TIMEOUT_REQUISICAO_MS = 10_000;
const RESPOSTA_BODY_MAXIMO = 2_000;

type Supabase = ReturnType<typeof createAdminClient>;

type WebhookAtivo = {
  id: string;
  url: string;
  bearer_token: string | null;
  cursos_ids: string[] | null;
};

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// `payload.curso_id` (quando existir) é o que o filtro por curso compara.
export function dispararWebhook(evento: WebhookEvento, payload: Record<string, unknown>): void {
  dispararWebhookComPayload(evento, async () => payload);
}

// Variante em que o payload precisa de consulta ao banco: a consulta também roda
// depois da resposta, então nem ela atrasa o fluxo principal. `obterPayload`
// devolvendo null cancela o disparo.
export function dispararWebhookComPayload(
  evento: WebhookEvento,
  obterPayload: () => Promise<Record<string, unknown> | null>,
): void {
  const tarefa = async () => {
    try {
      const payload = await obterPayload();
      if (payload) await executar(evento, payload);
    } catch (erro) {
      console.error(`[webhooks] falha ao disparar "${evento}"`, erro);
    }
  };

  try {
    after(tarefa);
  } catch {
    // Fora de um contexto de requisição (script, teste): segue solto, sem esperar.
    void tarefa();
  }
}

async function executar(evento: WebhookEvento, payload: Record<string, unknown>): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("webhooks_config")
    .select("id, url, bearer_token, cursos_ids")
    .eq("ativo", true)
    .contains("eventos", [evento]);
  // Tabela ainda inexistente (migration pendente) ou erro de leitura: nada a disparar.
  if (error || !data?.length) return;

  const cursoId = typeof payload.curso_id === "string" ? payload.curso_id : null;
  const destinos = (data as WebhookAtivo[]).filter((webhook) => {
    const cursos = webhook.cursos_ids ?? [];
    // Sem restrição = todos os cursos. Com restrição, só eventos DE um desses cursos
    // (evento sem curso, como um lead sem curso, não passa).
    return cursos.length === 0 || (cursoId !== null && cursos.includes(cursoId));
  });

  const timestamp = new Date().toISOString();
  await Promise.all(destinos.map((webhook) => entregar(admin, webhook, evento, payload, timestamp)));
}

async function entregar(
  admin: Supabase,
  webhook: WebhookAtivo,
  evento: WebhookEvento,
  payload: Record<string, unknown>,
  timestamp: string,
): Promise<void> {
  const { data: log } = await admin
    .from("webhooks_log")
    .insert({ webhook_id: webhook.id, evento, payload, status: "pendente", tentativas: 0 })
    .select("id")
    .single();
  const logId = log?.id as string | undefined;

  const atualizar = async (campos: Record<string, unknown>) => {
    if (logId) await admin.from("webhooks_log").update(campos).eq("id", logId);
  };

  // Revalida a URL no envio (o que está no banco pode ter sido escrito por fora da tela).
  const url = validarUrlWebhook(webhook.url);
  if (!url.ok) {
    await atualizar({ status: "falhou", resposta_body: `Envio bloqueado: ${url.erro}` });
    return;
  }

  const cabecalhos: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": evento,
    "X-Webhook-Timestamp": timestamp,
  };
  if (webhook.bearer_token) {
    try {
      cabecalhos.Authorization = `Bearer ${descriptografar(webhook.bearer_token)}`;
    } catch {
      await atualizar({
        status: "falhou",
        resposta_body: "Envio bloqueado: não foi possível ler o Bearer Token salvo (chave de criptografia ausente ou trocada). Salve o token de novo.",
      });
      return;
    }
  }
  const corpo = JSON.stringify({ event: evento, payload, timestamp });

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    let respostaStatus: number | null = null;
    let respostaBody: string | null = null;
    let entregue = false;

    try {
      const resposta = await fetch(url.url, {
        method: "POST",
        headers: cabecalhos,
        body: corpo,
        // Não segue redirecionamentos: um 302 pra um endereço interno furaria a checagem da URL.
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_REQUISICAO_MS),
      });
      respostaStatus = resposta.status;
      respostaBody = (await resposta.text().catch(() => "")).slice(0, RESPOSTA_BODY_MAXIMO);
      entregue = resposta.status >= 200 && resposta.status < 300;
    } catch (erro) {
      respostaBody = (erro instanceof Error ? erro.message : "Falha de rede").slice(0, RESPOSTA_BODY_MAXIMO);
    }

    const ultima = tentativa === TENTATIVAS_MAXIMAS;
    await atualizar({
      tentativas: tentativa,
      resposta_status: respostaStatus,
      resposta_body: respostaBody,
      status: entregue ? "entregue" : ultima ? "falhou" : "pendente",
    });

    if (entregue) return;
    if (!ultima) await esperar(INTERVALO_ENTRE_TENTATIVAS_MS);
  }
}
