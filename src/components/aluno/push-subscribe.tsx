"use client";

import { useEffect } from "react";
import { salvarPushSubscriptionAluno } from "@/app/aluno/actions";

// Mesma conversão da chave VAPID usada em push-notificacoes-form.tsx (admin)
// — applicationServerKey exige Uint8Array, não a string base64url.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const TENTATIVA_STORAGE_KEY = "genezi-push-aluno-tentativa";

// Registra o service worker em toda navegação dentro de /aluno e, se o
// navegador ainda não decidiu sobre a permissão de notificação, pede uma
// única vez — guarda em localStorage pra não insistir de novo depois de um
// dismiss/negação (mesmo espírito discreto do botão de instalação do PWA).
// Sem UI própria: roda em segundo plano, aluno nunca vê esse componente.
export function PushSubscribeAluno({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  useEffect(() => {
    async function registrarESubscrever() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        const registration = await navigator.serviceWorker.register("/sw.js");

        if (!vapidPublicKey) return;
        if (typeof Notification === "undefined" || Notification.permission === "denied") return;

        if (Notification.permission === "default") {
          const jaTentou = localStorage.getItem(TENTATIVA_STORAGE_KEY);
          if (jaTentou) return;
          localStorage.setItem(TENTATIVA_STORAGE_KEY, "1");
          const permissao = await Notification.requestPermission();
          if (permissao !== "granted") return;
        }

        const existente = await registration.pushManager.getSubscription();
        if (existente) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
        const subscriptionJson = subscription.toJSON();
        if (!subscriptionJson.endpoint || !subscriptionJson.keys) return;

        await salvarPushSubscriptionAluno({
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth_key: subscriptionJson.keys.auth,
        });
      } catch {
        // Best-effort — nunca deve afetar a navegação do aluno.
      }
    }
    registrarESubscrever();
  }, [vapidPublicKey]);

  return null;
}
