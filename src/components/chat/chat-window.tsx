"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTransition } from "react";
import { FileText, Paperclip, Pencil, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mensagemFormSchema } from "@/lib/chat/schema";
import type { ArquivoAnexo, MensagemChat } from "@/lib/chat/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { cn } from "@/lib/utils";

const ANEXO_BUCKET = "chat-arquivos";
const ANEXO_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ANEXO_TIPOS_ACEITOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatHoraBR(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AnexoPreview({
  url,
  nome,
  tipo,
}: {
  url: string;
  nome: string | null;
  tipo: string | null;
}) {
  if (tipo?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- anexo enviado pelo usuário, não passa pelo otimizador de imagens do Next */}
        <img src={url} alt={nome ?? "Imagem enviada"} className="max-h-56 rounded-lg object-cover" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1 flex items-center gap-2 underline underline-offset-2"
    >
      <FileText className="size-4 shrink-0" />
      <span className="truncate">{nome ?? "Arquivo"}</span>
    </a>
  );
}

// Componente por mensagem (module scope, não recriado a cada render do
// ChatWindow) — encapsula o estado local de hover/edição inline (TAREFA
// 2E), que só existe para mensagens do próprio remetente atual.
function MensagemBubble({
  mensagem,
  minha,
  podeEditarExcluir,
  editarAction,
  excluirAction,
}: {
  mensagem: MensagemChat;
  minha: boolean;
  podeEditarExcluir: boolean;
  editarAction?: (mensagemId: string, novoTexto: string) => Promise<{ error?: string }>;
  excluirAction?: (mensagemId: string) => Promise<{ error?: string }>;
}) {
  const [hover, setHover] = useState(false);
  const [editando, setEditando] = useState(false);
  const [valorEdicao, setValorEdicao] = useState(mensagem.texto);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mostrarAcoes = podeEditarExcluir && minha && !!editarAction && !!excluirAction;

  function handleIniciarEdicao() {
    setValorEdicao(mensagem.texto);
    setErro(null);
    setEditando(true);
  }

  function handleSalvarEdicao() {
    const novoTexto = valorEdicao.trim();
    if (!novoTexto || !editarAction) return;
    setErro(null);
    startTransition(async () => {
      const result = await editarAction(mensagem.id, novoTexto);
      if (result.error) {
        setErro(result.error);
        return;
      }
      setEditando(false);
    });
  }

  function handleExcluir() {
    if (!excluirAction) return;
    setErro(null);
    startTransition(async () => {
      const result = await excluirAction(mensagem.id);
      if (result.error) {
        setErro(result.error);
        return;
      }
      setConfirmandoExclusao(false);
    });
  }

  return (
    <div
      className={cn("flex flex-col", minha ? "items-end" : "items-start")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-1.5">
        {mostrarAcoes && hover && !editando && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleIniciarEdicao}
              className="text-muted-foreground hover:text-foreground rounded p-1"
              aria-label="Editar mensagem"
            >
              <Pencil className="size-3.5" />
            </button>
            <AlertDialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
              <AlertDialogTrigger
                render={
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive rounded p-1"
                    aria-label="Excluir mensagem"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir mensagem</AlertDialogTitle>
                  <AlertDialogDescription>
                    Excluir esta mensagem? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
                    {isPending ? "Excluindo..." : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {editando ? (
          <div className="flex w-64 flex-col gap-1.5">
            <Input
              autoFocus
              value={valorEdicao}
              onChange={(event) => setValorEdicao(event.target.value)}
              disabled={isPending}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSalvarEdicao();
                } else if (event.key === "Escape") {
                  setEditando(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !valorEdicao.trim()}
                onClick={handleSalvarEdicao}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
              minha ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {mensagem.arquivo_url && (
              <AnexoPreview url={mensagem.arquivo_url} nome={mensagem.arquivo_nome} tipo={mensagem.arquivo_tipo} />
            )}
            {mensagem.texto && <span>{mensagem.texto}</span>}
          </div>
        )}
      </div>
      <span className="text-muted-foreground mt-1 text-xs">{formatHoraBR(mensagem.created_at)}</span>
      {erro && <span className="text-destructive text-xs">{erro}</span>}
    </div>
  );
}

// Client Component — é a primeira tela do projeto com subscription de
// Supabase Realtime. Histórico inicial vem via props (buscado no Server
// Component da página); daqui pra frente, INSERT/UPDATE/DELETE em tempo
// real alimentam a lista (UPDATE/DELETE adicionados na TAREFA 2E, pra
// editar/excluir refletir em ambos os lados da conversa). RLS de
// mensagens_chat já restringe o que cada lado pode receber — o filtro
// abaixo é conveniência, não a fronteira de segurança.
export function ChatWindow({
  conversaId,
  currentUserId,
  outroLadoLabel,
  initialMensagens,
  enviarAction,
  marcarLidasAction,
  podeAnexarArquivo = false,
  podeEditarExcluir = false,
  editarAction,
  excluirAction,
}: {
  conversaId: string;
  currentUserId: string;
  outroLadoLabel: string;
  initialMensagens: MensagemChat[];
  enviarAction: (texto: string, arquivo?: ArquivoAnexo) => Promise<{ error?: string }>;
  marcarLidasAction: () => Promise<void>;
  podeAnexarArquivo?: boolean;
  podeEditarExcluir?: boolean;
  editarAction?: (mensagemId: string, novoTexto: string) => Promise<{ error?: string }>;
  excluirAction?: (mensagemId: string) => Promise<{ error?: string }>;
}) {
  const [mensagens, setMensagens] = useState<MensagemChat[]>(initialMensagens);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensagens_chat",
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const atualizada = payload.new as MensagemChat;
          setMensagens((prev) => prev.map((m) => (m.id === atualizada.id ? atualizada : m)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "mensagens_chat",
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const removida = payload.old as { id: string };
          setMensagens((prev) => prev.filter((m) => m.id !== removida.id));
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

  function handleInserirEmoji(emoji: string) {
    const posicao = textareaRef.current?.selectionStart ?? texto.length;
    const novoTexto = texto.slice(0, posicao) + emoji + texto.slice(posicao);
    setTexto(novoTexto);
    requestAnimationFrame(() => {
      const novaPosicao = posicao + emoji.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(novaPosicao, novaPosicao);
    });
  }

  async function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setErro(null);

    if (!ANEXO_TIPOS_ACEITOS.includes(file.type)) {
      setErro("Formato não aceito. Use imagem (JPG/PNG/WEBP), PDF ou documento (DOC/DOCX).");
      return;
    }
    if (file.size > ANEXO_MAX_BYTES) {
      setErro("Arquivo muito grande. Máximo permitido: 10MB.");
      return;
    }

    setEnviandoArquivo(true);
    try {
      const extensao = file.name.split(".").pop() ?? "bin";
      const path = `${conversaId}/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

      const { error: uploadError } = await supabase.storage.from(ANEXO_BUCKET).upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) {
        setErro("Não foi possível enviar o arquivo.");
        return;
      }

      const { data: urlData } = supabase.storage.from(ANEXO_BUCKET).getPublicUrl(path);

      const result = await enviarAction(texto.trim(), { url: urlData.publicUrl, nome: file.name, tipo: file.type });
      if (result.error) {
        setErro(result.error);
        return;
      }
      setTexto("");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {mensagens.length === 0 ? (
          <p className="text-muted-foreground m-auto text-sm">
            Nenhuma mensagem ainda. Envie a primeira mensagem para {outroLadoLabel}.
          </p>
        ) : (
          mensagens.map((m) => (
            <MensagemBubble
              key={m.id}
              mensagem={m}
              minha={m.remetente_id === currentUserId}
              podeEditarExcluir={podeEditarExcluir}
              editarAction={editarAction}
              excluirAction={excluirAction}
            />
          ))
        )}
        <div ref={bottomRef} />
      </CardContent>
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t p-3">
        {podeAnexarArquivo && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
              onChange={handleArquivoChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviandoArquivo}
              aria-label="Anexar arquivo"
            >
              <Paperclip />
            </Button>
          </>
        )}
        <EmojiPicker onSelect={handleInserirEmoji} />
        <Textarea
          ref={textareaRef}
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
        <Button type="submit" size="icon" disabled={isPending || enviandoArquivo || texto.trim().length === 0}>
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
