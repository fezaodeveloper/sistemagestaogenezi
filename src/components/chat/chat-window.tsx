"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTransition } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mensagemFormSchema } from "@/lib/chat/schema";
import type { MensagemChat } from "@/lib/chat/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatHoraBR(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Client Component — é a primeira tela do projeto com subscription de
// Supabase Realtime. Histórico inicial vem via props (buscado no Server
// Component da página); daqui pra frente, só o INSERT em tempo real
// alimenta a lista. RLS de mensagens_chat já restringe o que cada lado
// pode receber — o filtro abaixo é conveniência, não a fronteira de
// segurança.
export function ChatWindow({
  conversaId,
  currentUserId,
  outroLadoLabel,
  initialMensagens,
  enviarAction,
  marcarLidasAction,
}: {
  conversaId: string;
  currentUserId: string;
  outroLadoLabel: string;
  initialMensagens: MensagemChat[];
  enviarAction: (texto: string) => Promise<{ error?: string }>;
  marcarLidasAction: () => Promise<void>;
}) {
  const [mensagens, setMensagens] = useState<MensagemChat[]>(initialMensagens);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    marcarLidasAction();

    const channel = supabase
      .channel(`conversa-${conversaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_chat",
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const nova = payload.new as MensagemChat;
          setMensagens((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]));
          if (nova.remetente_id !== currentUserId) {
            marcarLidasAction();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const parsed = mensagemFormSchema.safeParse({ texto });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Mensagem inválida.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const result = await enviarAction(parsed.data.texto);
      if (result.error) {
        setErro(result.error);
      } else {
        setTexto("");
      }
    });
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {mensagens.length === 0 ? (
          <p className="text-muted-foreground m-auto text-sm">
            Nenhuma mensagem ainda. Envie a primeira mensagem para {outroLadoLabel}.
          </p>
        ) : (
          mensagens.map((m) => {
            const minha = m.remetente_id === currentUserId;
            return (
              <div key={m.id} className={cn("flex flex-col", minha ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    minha ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.texto}
                </div>
                <span className="text-muted-foreground mt-1 text-xs">{formatHoraBR(m.created_at)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </CardContent>
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Mensagem para ${outroLadoLabel}...`}
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={isPending || texto.trim().length === 0}>
          <Send />
        </Button>
      </form>
      {erro && (
        <p role="alert" className="text-destructive px-3 pb-3 text-sm">
          {erro}
        </p>
      )}
    </Card>
  );
}
