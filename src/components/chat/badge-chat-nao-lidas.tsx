"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidebarMenuBadge } from "@/components/ui/sidebar";

// Badge ao vivo da sidebar (admin e aluno) — reage a qualquer INSERT/UPDATE
// em mensagens_chat (filtro opcional por conversa, pro lado do aluno) e
// sempre busca a contagem de verdade de novo (via refetchAction), em vez
// de tentar acompanhar incrementos/decrementos manualmente no client —
// mais simples e sem risco de desincronizar. A sidebar persiste entre
// navegações (é o layout, não a page), então isso também é o que garante
// o badge atualizar depois de abrir/ler uma conversa em outra tela, sem
// precisar de reload.
export function BadgeChatNaoLidas({
  initialCount,
  realtimeFilter,
  refetchAction,
}: {
  initialCount: number;
  realtimeFilter?: string;
  refetchAction: () => Promise<number>;
}) {
  // initialCount só é usado no valor inicial — se o servidor mandar um
  // novo initialCount (ex.: revalidatePath depois de marcar como lida),
  // o componente precisa REMONTAR pra refletir isso, não sincronizar via
  // effect (anti-padrão). Por isso o call site usa key={initialCount}.
  const [count, setCount] = useState(initialCount);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`badge-chat-${realtimeFilter ?? "admin"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensagens_chat",
          ...(realtimeFilter ? { filter: realtimeFilter } : {}),
        },
        () => {
          refetchAction().then(setCount);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeFilter]);

  if (count === 0) return null;

  return <SidebarMenuBadge>{count}</SidebarMenuBadge>;
}
