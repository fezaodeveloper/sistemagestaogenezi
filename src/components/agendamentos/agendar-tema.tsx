"use client";

// "use client": preferência de tema em localStorage, matchMedia e botão de alternar.

import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Preferencia = "auto" | "claro" | "escuro";

const STORAGE_KEY = "agendar_tema";

function lerPreferencia(): Preferencia {
  try {
    const salva = localStorage.getItem(STORAGE_KEY);
    return salva === "claro" || salva === "escuro" ? salva : "auto";
  } catch {
    return "auto";
  }
}

// Moldura da página pública de agendamento com tema claro/escuro.
//  - Padrão ("auto"): segue prefers-color-scheme do sistema. Essa parte é CSS
//    puro (globals.css, .agendar-tema) e vale já no HTML do servidor — sem
//    "flash" de tema claro pra quem usa o sistema em escuro.
//  - O botão força claro/escuro e lembra a escolha neste navegador
//    (localStorage; o data-tema é aplicado após a hidratação).
//  - A classe `dark` (só depois de montar) liga as variantes `dark:` do
//    Tailwind usadas nos avisos vermelho/âmbar dos componentes.
export function AgendarTema({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<Preferencia>("auto");
  const [sistemaEscuro, setSistemaEscuro] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect); localStorage/matchMedia só existem no client.
    queueMicrotask(() => {
      setPreferencia(lerPreferencia());
      setSistemaEscuro(consulta.matches);
    });
    const aoMudar = (evento: MediaQueryListEvent) => setSistemaEscuro(evento.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  const escuro = preferencia === "escuro" || (preferencia === "auto" && sistemaEscuro);

  function alternar() {
    const proxima: Preferencia = escuro ? "claro" : "escuro";
    setPreferencia(proxima);
    try {
      localStorage.setItem(STORAGE_KEY, proxima);
    } catch {
      // Sem localStorage a escolha vale só até recarregar.
    }
  }

  return (
    <main
      data-tema={preferencia}
      className={`agendar-tema bg-background text-foreground relative flex min-h-svh flex-col items-center p-6 ${escuro ? "dark" : ""}`}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={alternar}
        className="absolute top-4 right-4"
        aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
        title={escuro ? "Tema claro" : "Tema escuro"}
      >
        {escuro ? <Sun /> : <Moon />}
      </Button>
      {children}
    </main>
  );
}
