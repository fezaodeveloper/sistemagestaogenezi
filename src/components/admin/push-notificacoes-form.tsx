"use client";

import { useEffect, useState, useTransition } from "react";
import { gerarChavesVapid, salvarPushSubscription } from "@/app/admin/configuracoes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// applicationServerKey exige um Uint8Array, não a string base64url que a
// chave VAPID pública realmente é — conversão padrão recomendada pela
// própria documentação da Push API.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// "Ativado" aqui é sempre por navegador (subscription do próprio
// pushManager), não uma flag no servidor — o mesmo admin logado em dois
// navegadores diferentes precisa ativar em cada um.
export function PushNotificacoesForm({ vapidPublicKeyInicial }: { vapidPublicKeyInicial: string | null }) {
  const [vapidPublicKey, setVapidPublicKey] = useState(vapidPublicKeyInicial);
  const [ativado, setAtivado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    async function verificar() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelado) setAtivado(Boolean(subscription));
      } catch {
        // Navegador sem suporte ou erro de permissão — trata como "não ativado".
      } finally {
        if (!cancelado) setVerificando(false);
      }
    }
    verificar();
    return () => {
      cancelado = true;
    };
  }, []);

  function handleGerarChaves() {
    setError(null);
    startTransition(async () => {
      const resultado = await gerarChavesVapid();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setVapidPublicKey(resultado.publicKey ?? null);
    });
  }

  function handleAtivar() {
    setError(null);
    startTransition(async () => {
      if (!vapidPublicKey) {
        setError("Gere as chaves VAPID antes de ativar.");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
        const subscriptionJson = subscription.toJSON();
        if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
          setError("Não foi possível obter os dados da inscrição push.");
          return;
        }

        const resultado = await salvarPushSubscription({
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth_key: subscriptionJson.keys.auth,
        });
        if (resultado.error) {
          setError(resultado.error);
          return;
        }
        setAtivado(true);
      } catch {
        setError("Não foi possível ativar as notificações neste navegador.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">Status neste navegador:</span>
        {verificando ? (
          <Badge variant="outline">Verificando...</Badge>
        ) : ativado ? (
          <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
            Ativado ✅
          </Badge>
        ) : (
          <Badge variant="outline">Não ativado</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!vapidPublicKey && (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleGerarChaves}>
            {isPending ? "Gerando..." : "Gerar chaves VAPID"}
          </Button>
        )}
        <Button type="button" disabled={isPending || !vapidPublicKey || ativado} onClick={handleAtivar}>
          {isPending ? "Ativando..." : "Ativar notificações neste navegador"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
