import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type VapidKeys = { publicKey: string; privateKey: string };

// Gera o par de chaves VAPID e salva direto em configuracoes — chamada uma
// única vez (o botão "Gerar chaves VAPID" só aparece enquanto não existem,
// ver push-notificacoes-form.tsx). Gerar de novo depois invalidaria toda
// subscription já salva (a chave pública muda), por isso não há botão de
// "regenerar" nesta tarefa.
export async function gerarVapidKeys(): Promise<VapidKeys> {
  const keys = webpush.generateVAPIDKeys();

  const admin = createAdminClient();
  await admin
    .from("configuracoes")
    .update({ push_vapid_public_key: keys.publicKey, push_vapid_private_key: keys.privateKey })
    .eq("id", true);

  return { publicKey: keys.publicKey, privateKey: keys.privateKey };
}

// Envia uma notificação push pra todas as subscriptions de admin
// cadastradas (push_subscriptions não distingue "qual admin" — a policy
// "Admins gerenciam push" já restringe quem pode ler/escrever ali, então
// qualquer subscription na tabela é, por definição, de um admin). Best-effort
// por subscription — uma falha isolada (endpoint expirado) não deve impedir
// o envio pras demais nem lançar pro chamador (mesmo espírito de
// dispararEvento em automacoes/motor.ts).
export async function enviarPushAdmin(titulo: string, corpo: string, url: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("configuracoes")
      .select("push_vapid_public_key, push_vapid_private_key, escola_email")
      .eq("id", true)
      .maybeSingle();

    if (!config?.push_vapid_public_key || !config?.push_vapid_private_key) return;

    webpush.setVapidDetails(
      `mailto:${config.escola_email ?? "contato@genezi.com.br"}`,
      config.push_vapid_public_key,
      config.push_vapid_private_key,
    );

    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key");

    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({ title: titulo, body: corpo, url });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
            },
            payload,
          );
        } catch (erro) {
          // 404/410 = endpoint não existe mais (navegador desinstalado,
          // permissão revogada) — remove pra não tentar de novo pra sempre.
          // Qualquer outro erro é ignorado (best-effort de verdade).
          const statusCode = (erro as { statusCode?: number } | null)?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", subscription.id);
          }
        }
      }),
    );
  } catch {
    // Best-effort — nunca deve afetar o chamador (handlers de Telegram).
  }
}
