import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { processarMensagemRecebida } from "@/lib/whatsapp/webhook-entrada";

// Retomar um fluxo pausado pode cair num nó "mensagem" (delay anti-banimento embutido em
// enviarWhatsApp) — mesmo raciocínio do maxDuration elevado já usado em /api/whatsapp/conectar e
// no cron whatsapp-fluxos.
export const maxDuration = 30;

type EvolutionWebhookPayload = {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: unknown;
      imageMessage?: unknown;
      documentMessage?: unknown;
    };
  };
};

type TipoMensagemRecebida = "texto" | "audio" | "imagem" | "documento" | "outro";

// Webhook de ENTRADA da Evolution API V2 (mensagens recebidas no número conectado do GênZap) —
// mesmo padrão de src/app/api/webhooks/asaas/route.ts: autentica por token no header, sempre
// responde 200 (nunca deixa o provedor reenviar por erro interno), grava log antes de processar.
//
// Tabelas usadas aqui (whatsapp_sessoes, whatsapp_mensagens_recebidas, e as colunas
// aguardando_resposta/resposta_recebida em whatsapp_fluxos_execucoes) vêm da migration
// 20261016000000_whatsapp_webhook_entrada.sql — AINDA NÃO APLICADA. Este endpoint só funciona de
// verdade depois que ela for aplicada manualmente no Supabase.
export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
  if (!process.env.EVOLUTION_WEBHOOK_SECRET || token !== process.env.EVOLUTION_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as EvolutionWebhookPayload | null;
  if (!payload) return new Response("OK", { status: 200 });

  if (payload.event !== "messages.upsert") return new Response("OK", { status: 200 });
  if (payload.data?.key?.fromMe === true) return new Response("OK", { status: 200 });

  const remoteJid = payload.data?.key?.remoteJid ?? "";
  const telefone = remoteJid.split("@")[0];
  if (!telefone) return new Response("OK", { status: 200 });

  const nomeContato = payload.data?.pushName ?? null;
  const msg = payload.data?.message ?? {};
  const texto = msg.conversation ?? msg.extendedTextMessage?.text ?? null;

  let tipo: TipoMensagemRecebida = "outro";
  if (texto) tipo = "texto";
  else if (msg.audioMessage) tipo = "audio";
  else if (msg.imageMessage) tipo = "imagem";
  else if (msg.documentMessage) tipo = "documento";

  const admin = createAdminClient();
  const { data: logEntry } = await admin
    .from("whatsapp_mensagens_recebidas")
    .insert({
      telefone,
      nome_contato: nomeContato,
      mensagem: texto ?? "(sem texto)",
      tipo,
      payload_bruto: payload,
    })
    .select("id")
    .single();

  if (texto?.trim()) {
    try {
      await processarMensagemRecebida(admin, telefone, nomeContato, texto.trim(), logEntry?.id);
    } catch (err) {
      console.error("[evolution:webhook] erro ao processar mensagem:", err);
    }
  }

  return new Response("OK", { status: 200 });
}
