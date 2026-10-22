"use client";

// "use client": popover com lista buscada sob demanda (ao abrir, não no carregamento da
// página) via Server Action — mesmo padrão lazy já usado em outros dialogs de detalhe do
// projeto (ex.: DetalhesInscritosDialog em cursos-gratuitos-table.tsx).

import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import {
  excluirNotificacao,
  excluirNotificacoesLidas,
  getNotificacoesAluno,
  marcarComoLida,
  marcarTodasComoLidas,
  type NotificacaoAluno,
} from "@/app/aluno/notificacoes/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatarTempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return "ontem";
  if (diffDias < 7) return `há ${diffDias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

type Confirmacao = { tipo: "uma"; id: string } | { tipo: "lidas" } | null;

export function SinoNotificacoesAluno({ naoLidasInicial }: { naoLidasInicial: number }) {
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoAluno[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);

  // Enquanto o popover nunca foi aberto, usa a contagem vinda do server (layout.tsx) — evita
  // mostrar "0" piscando até a primeira busca completar.
  const naoLidas = notificacoes ? notificacoes.filter((n) => !n.lida).length : naoLidasInicial;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && notificacoes === null) {
      setCarregando(true);
      getNotificacoesAluno()
        .then(setNotificacoes)
        .finally(() => setCarregando(false));
    }
  }

  function recarregar() {
    getNotificacoesAluno().then(setNotificacoes);
  }

  function handleMarcarLida(id: string) {
    setNotificacoes((lista) => lista?.map((n) => (n.id === id ? { ...n, lida: true } : n)) ?? lista);
    marcarComoLida(id);
  }

  function handleMarcarTodasLidas() {
    setNotificacoes((lista) => lista?.map((n) => ({ ...n, lida: true })) ?? lista);
    marcarTodasComoLidas();
  }

  async function confirmarExclusao() {
    if (confirmacao?.tipo === "uma") {
      setNotificacoes((lista) => lista?.filter((n) => n.id !== confirmacao.id) ?? lista);
      await excluirNotificacao(confirmacao.id);
    } else if (confirmacao?.tipo === "lidas") {
      setNotificacoes((lista) => lista?.filter((n) => !n.lida) ?? lista);
      await excluirNotificacoesLidas();
    }
    setConfirmacao(null);
    recarregar();
  }

  const lista = notificacoes ?? [];
  const temLidas = lista.some((n) => n.lida);

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
              aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
            >
              <Bell />
              {naoLidas > 0 && (
                <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white">
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-80">
          {carregando ? (
            <p className="text-muted-foreground py-2 text-center text-sm">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">Nenhuma notificação ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 border-b pb-2">
                <span className="text-sm font-medium">
                  Notificações
                  {naoLidas > 0 && <span className="text-muted-foreground ml-1 text-xs">({naoLidas} não lidas)</span>}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={naoLidas === 0}
                    onClick={handleMarcarTodasLidas}
                  >
                    <CheckCheck />
                    Marcar todas como lidas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={!temLidas}
                    onClick={() => setConfirmacao({ tipo: "lidas" })}
                  >
                    Limpar lidas
                  </Button>
                </div>
              </div>

              <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                {lista.map((notificacao) => (
                  <div
                    key={notificacao.id}
                    className={`-mx-2 flex items-start gap-1 rounded-md px-2 py-1.5 ${
                      notificacao.lida ? "" : "bg-muted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => !notificacao.lida && handleMarcarLida(notificacao.id)}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1 py-0.5 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{notificacao.titulo}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatarTempoRelativo(notificacao.created_at)}
                        </span>
                      </div>
                      {notificacao.corpo && (
                        <span className="text-muted-foreground line-clamp-2 text-xs">{notificacao.corpo}</span>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {!notificacao.lida && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Marcar como lida"
                          title="Marcar como lida"
                          onClick={() => handleMarcarLida(notificacao.id)}
                        >
                          <Check />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="Excluir notificação"
                        title="Excluir"
                        onClick={() => setConfirmacao({ tipo: "uma", id: notificacao.id })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmacao !== null} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === "lidas" ? "Limpar notificações lidas" : "Excluir notificação"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === "lidas"
                ? "Remover todas as notificações já lidas? Esta ação não pode ser desfeita."
                : "Remover esta notificação? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmarExclusao}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
