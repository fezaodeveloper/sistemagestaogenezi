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

// Envia uma notificação push pra um subconjunto de subscriptions
// (admin: aluno_id null / alunos: aluno_id preenchido — ver migration
// 20260917800000_push_subscriptions_alunos.sql). Best-effort por
// subscription — uma falha isolada (endpoint expirado) não deve impedir o
// envio pras demais nem lançar pro chamador (mesmo espírito de
// dispararEvento em automacoes/motor.ts). Retorna quantas subscriptions
// foram encontradas (tentativas de envio, não confirmação de entrega).
async function enviarPushPara(
  titulo: string,
  corpo: string,
  url: string,
  filtro: "admin" | "aluno" | { alunoId: string },
): Promise<number> {
  try {
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("configuracoes")
      .select("push_vapid_public_key, push_vapid_private_key, escola_email")
      .eq("id", true)
      .maybeSingle();

    if (!config?.push_vapid_public_key || !config?.push_vapid_private_key) return 0;

    webpush.setVapidDetails(
      `mailto:${config.escola_email ?? "contato@genezi.com.br"}`,
      config.push_vapid_public_key,
      config.push_vapid_private_key,
    );

    let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key");
    if (filtro === "admin") query = query.is("aluno_id", null);
    else if (filtro === "aluno") query = query.not("aluno_id", "is", null);
    else query = query.eq("aluno_id", filtro.alunoId);
    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) return 0;

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

    return subscriptions.length;
  } catch {
    // Best-effort — nunca deve afetar o chamador (handlers de Telegram).
    return 0;
  }
}

// Só pras subscriptions do próprio admin (aluno_id null) — usada pelos
// alertas internos (financeiro atrasado, certificados pendentes etc. em
// automacoes/handlers/telegram.ts). Nunca deve vazar pra dispositivos de
// aluno, por isso o filtro explícito.
export async function enviarPushAdmin(titulo: string, corpo: string, url: string): Promise<void> {
  await enviarPushPara(titulo, corpo, url, "admin");
}

// Notificação disparada manualmente pelo admin pra todos os alunos com
// subscription ativa (item 7 do roadmap — /admin/notificacoes). Retorna a
// quantidade de dispositivos pra que a tela mostre o resultado do envio.
export async function enviarPushAlunos(titulo: string, corpo: string, url: string): Promise<number> {
  return enviarPushPara(titulo, corpo, url, "aluno");
}

// Notificação pra UM aluno específico (todos os dispositivos dele) — ex.: o admin
// respondeu um comentário dele numa aula. Best-effort como as demais: aluno sem
// dispositivo registrado (ou push não configurado) retorna 0 e nunca lança.
export async function enviarPushParaAluno(
  alunoId: string,
  titulo: string,
  corpo: string,
  url: string,
): Promise<number> {
  return enviarPushPara(titulo, corpo, url, { alunoId });
}
