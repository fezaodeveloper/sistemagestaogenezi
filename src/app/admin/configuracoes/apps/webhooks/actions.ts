"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import { WEBHOOK_EVENTOS, validarUrlWebhook } from "@/lib/webhooks/eventos";

export type DadosWebhookForm = {
  nome: string;
  url: string;
  // Vazio ao editar = manter o token salvo (ele nunca volta pra tela).
  bearerToken: string;
  // true = apagar o token salvo.
  removerToken: boolean;
  eventos: string[];
  // Vazio = todos os cursos.
  cursosIds: string[];
  ativo: boolean;
};

export type SalvarWebhookResultado = { success: true } | { error: string };

const dadosSchema = z.object({
  nome: z.string().trim().min(1, { error: "Informe o nome do webhook." }).max(100, { error: "O nome pode ter no máximo 100 caracteres." }),
  url: z.string().trim().min(1, { error: "Informe a URL." }).max(2000, { error: "URL longa demais." }),
  bearerToken: z.string().max(2000, { error: "Bearer Token longo demais." }),
  removerToken: z.boolean(),
  eventos: z.array(z.enum(WEBHOOK_EVENTOS)).min(1, { error: "Selecione pelo menos um evento." }),
  cursosIds: z.array(z.uuid({ error: "Curso inválido." })).max(500),
  ativo: z.boolean(),
});

export async function salvarWebhook(id: string | null, dadosBrutos: DadosWebhookForm): Promise<SalvarWebhookResultado> {
  await requireRole("admin");

  if (id !== null && !z.uuid().safeParse(id).success) return { error: "Webhook inválido." };

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const url = validarUrlWebhook(dados.url);
  if (!url.ok) return { error: url.erro };

  const campos: Record<string, unknown> = {
    nome: dados.nome,
    url: url.url,
    eventos: [...new Set(dados.eventos)],
    cursos_ids: [...new Set(dados.cursosIds)],
    ativo: dados.ativo,
  };

  // Token: novo valor -> criptografa; "remover" -> null; em branco -> não mexe.
  const novoToken = dados.bearerToken.trim();
  if (novoToken) {
    try {
      campos.bearer_token = criptografar(novoToken);
    } catch (erro) {
      if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
      return { error: "Não foi possível proteger o Bearer Token. Tente novamente." };
    }
  } else if (dados.removerToken) {
    campos.bearer_token = null;
  }

  const supabase = await createClient();
  const { error } =
    id === null
      ? await supabase.from("webhooks_config").insert(campos)
      : await supabase.from("webhooks_config").update(campos).eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar o webhook. Confira se a migration webhooks_config foi aplicada." };
  }

  revalidatePath("/admin/configuracoes/apps/webhooks");
  revalidatePath("/admin/configuracoes/apps");
  return { success: true };
}

export async function alternarAtivoWebhook(id: string, ativo: boolean): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Webhook inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("webhooks_config").update({ ativo }).eq("id", id);
  if (error) return { error: "Não foi possível alterar o webhook." };

  revalidatePath("/admin/configuracoes/apps/webhooks");
  return {};
}

// O histórico de entregas (webhooks_log) vai junto por ON DELETE CASCADE.
export async function excluirWebhook(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Webhook inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("webhooks_config").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir o webhook." };

  revalidatePath("/admin/configuracoes/apps/webhooks");
  revalidatePath("/admin/configuracoes/apps");
  return {};
}

export type LogWebhook = {
  id: string;
  evento: string;
  status: "entregue" | "falhou" | "pendente";
  tentativas: number;
  resposta_status: number | null;
  resposta_body: string | null;
  payload: unknown;
  created_at: string;
};

const LOGS_POR_CONSULTA = 50;

export async function listarLogsWebhook(webhookId: string): Promise<{ logs: LogWebhook[] } | { error: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(webhookId).success) return { error: "Webhook inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks_log")
    .select("id, evento, status, tentativas, resposta_status, resposta_body, payload, created_at")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(LOGS_POR_CONSULTA);

  if (error) return { error: "Não foi possível carregar o histórico de entregas." };
  return { logs: (data ?? []) as LogWebhook[] };
}
