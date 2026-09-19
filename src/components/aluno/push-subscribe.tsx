"use client";

import { useEffect, useState } from "react";
import { salvarPushSubscriptionAluno } from "@/app/aluno/actions";
import { Button } from "@/components/ui/button";

const LOG = "[push]";

// applicationServerKey exige Uint8Array, não a string base64url (mesma
// conversão de push-notificacoes-form.tsx, do admin).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function mesmaChave(subscription: PushSubscription, chave: Uint8Array): boolean {
  const atual = subscription.options.applicationServerKey;
  if (!atual) return false;
  const bytes = new Uint8Array(atual);
  return bytes.length === chave.length && bytes.every((byte, indice) => byte === chave[indice]);
}

// Registra o service worker, ESPERA ele ficar ativo, garante uma subscription
// e grava a mais recente no banco.
//
// - `serviceWorker.ready` (e não só o retorno de register()): na primeira
//   visita o worker ainda está "installing" quando register() resolve, e
//   pushManager.subscribe() falha com "no active Service Worker".
// - Sempre grava no banco, mesmo se o navegador já tinha a subscription: se uma
//   tentativa anterior falhou depois do subscribe(), a inscrição ficava só no
//   navegador e nunca chegava ao servidor. O servidor faz upsert por endpoint
//   (e reatribui o aparelho ao aluno logado — ver salvarPushSubscriptionAluno).
async function assinarESalvar(vapidPublicKey: string): Promise<void> {
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const chave = urlBase64ToUint8Array(vapidPublicKey);

  let subscription = await registration.pushManager.getSubscription();
  // Inscrição criada com outra chave VAPID (chaves regeneradas) não recebe
  // mais nada — descarta e cria de novo.
  if (subscription && !mesmaChave(subscription, chave)) {
    console.warn(LOG, "subscription existente usa outra chave VAPID; recriando");
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chave as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("subscription sem endpoint/chaves");
  }

  const resultado = await salvarPushSubscriptionAluno({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
  });
  if (resultado.error) throw new Error(resultado.error);
}

type Estado = "carregando" | "indisponivel" | "ios-instalar" | "bloqueado" | "inativo" | "ativo";

// Botão "Ativar notificações" do portal do aluno. O pedido de permissão só
// acontece no CLIQUE (navegadores — Safari/iOS em especial — ignoram ou
// suprimem pedido automático, e antes disso a tentativa única ficava gasta
// sem nunca ter perguntado nada). Se a permissão já foi concedida, sincroniza
// a subscription em segundo plano a cada carregamento.
export function PushSubscribeAluno({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function inicializar() {
      try {
        const suporta =
          "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";

        if (!suporta) {
          const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
          const instalado =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true;
          console.warn(LOG, "navegador sem suporte a push", { ios, instalado });
          if (!cancelado) setEstado(ios && !instalado ? "ios-instalar" : "indisponivel");
          return;
        }

        if (!vapidPublicKey) {
          console.warn(LOG, "chave VAPID pública ausente — gere as chaves em /admin/configuracoes");
          if (!cancelado) setEstado("indisponivel");
          return;
        }

        if (Notification.permission === "denied") {
          if (!cancelado) setEstado("bloqueado");
          return;
        }

        if (Notification.permission === "granted") {
          await assinarESalvar(vapidPublicKey);
          if (!cancelado) setEstado("ativo");
          return;
        }

        if (!cancelado) setEstado("inativo");
      } catch (falha) {
        console.error(LOG, "falha ao sincronizar a subscription", falha);
        if (!cancelado) {
          setErro("Não foi possível sincronizar as notificações. Toque para tentar de novo.");
          setEstado("inativo");
        }
      }
    }

    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect) — Notification/serviceWorker só
    // existem no client.
    queueMicrotask(inicializar);
    return () => {
      cancelado = true;
    };
  }, [vapidPublicKey]);

  async function handleAtivar() {
    if (!vapidPublicKey) return;
    setErro(null);
    setProcessando(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao === "denied") {
        console.warn(LOG, "permissão negada pelo usuário");
        setEstado("bloqueado");
        return;
      }
      if (permissao !== "granted") {
        console.warn(LOG, "permissão não concedida:", permissao);
        setErro("Permissão não concedida. Toque de novo para tentar.");
        return;
      }
      await assinarESalvar(vapidPublicKey);
      setEstado("ativo");
    } catch (falha) {
      console.error(LOG, "falha ao ativar notificações", falha);
      setErro("Não foi possível ativar as notificações. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  if (estado === "carregando" || estado === "indisponivel") return null;

  const textoPequeno = "px-2 pb-1 text-center text-[11px] text-muted-foreground";

  if (estado === "ios-instalar") {
    return (
      <p className={textoPequeno}>
        Para receber notificações no iPhone, instale o app (Compartilhar → Adicionar à Tela de Início).
      </p>
    );
  }
  if (estado === "bloqueado") {
    return <p className={textoPequeno}>🔕 Notificações bloqueadas. Libere nas configurações do navegador.</p>;
  }
  if (estado === "ativo") {
    return <p className={textoPequeno}>🔔 Notificações ativadas</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" className="mx-2 mb-1" disabled={processando} onClick={handleAtivar}>
        {processando ? "Ativando..." : "🔔 Ativar notificações"}
      </Button>
      {erro && (
        <p role="alert" className="text-destructive px-2 pb-1 text-center text-[11px]">
          {erro}
        </p>
      )}
    </div>
  );
}
