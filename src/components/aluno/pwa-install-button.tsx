"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// BeforeInstallPromptEvent só existe em navegadores Chromium (Android/desktop)
// — no iOS/Safari o evento nunca dispara, daí o fallback com instruções
// manuais mais abaixo (não existe API de instalação programática no Safari).
export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [instalado, setInstalado] = useState(false);
  const [showIosDialog, setShowIosDialog] = useState(false);

  useEffect(() => {
    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect) — essas detecções só existem no
    // client, precisam rodar depois do mount.
    queueMicrotask(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
      setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (isInstalled) return null;

  async function handleInstalarAndroid() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const escolha = await promptEvent.userChoice;
    if (escolha.outcome === "accepted") {
      setInstalado(true);
      setPromptEvent(null);
    }
  }

  if (instalado) {
    return <p className="px-2 pb-1 text-center text-[11px] text-muted-foreground">✅ App instalado!</p>;
  }

  if (promptEvent) {
    return (
      <Button type="button" variant="outline" size="sm" className="mx-2 mb-1" onClick={handleInstalarAndroid}>
        📲 Instalar app no celular
      </Button>
    );
  }

  if (!isIOS) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="mx-2 mb-1" onClick={() => setShowIosDialog(true)}>
        📲 Instalar app no celular
      </Button>
      <Dialog open={showIosDialog} onOpenChange={setShowIosDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar no iPhone/iPad</DialogTitle>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="text-2xl">⬆️</span>
              <span>Toque no ícone de compartilhar (□↑) na barra do Safari</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">➕</span>
              <span>Role para baixo e toque em &quot;Adicionar à Tela de Início&quot;</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <span>Toque em &quot;Adicionar&quot; no canto superior direito</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
