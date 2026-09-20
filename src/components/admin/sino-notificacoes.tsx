"use client";

// "use client": estado de leitura/exclusão guardado no localStorage, popover e diálogos de confirmação.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
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
import type { NotificacaoSinoGrupo } from "@/lib/admin/notificacoes";

// As notificações do sino não são registros no banco: são calculadas a cada
// carregamento a partir da situação atual (parcelas em atraso, certificados
// pendentes, eventos). Por isso "lida"/"excluída" fica só neste navegador
// (localStorage), preso a uma ASSINATURA do conteúdo (quantidade + itens): se a
// situação mudar — mais parcelas em atraso, outro evento — a notificação volta
// como não lida, em vez de ficar escondida por um "lida" antigo.
const STORAGE_KEY = "genezi-sino-notificacoes";

type EstadoNotificacao = { assinatura: string; estado: "lida" | "excluida" };
type Estados = Record<string, EstadoNotificacao>;

function assinatura(grupo: NotificacaoSinoGrupo): string {
  return `${grupo.quantidade}|${(grupo.itens ?? []).join(",")}`;
}

function lerEstados(): Estados {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    const dados: unknown = bruto ? JSON.parse(bruto) : {};
    if (typeof dados !== "object" || dados === null) return {};
    const estados: Estados = {};
    for (const [tipo, valor] of Object.entries(dados)) {
      const v = valor as Partial<EstadoNotificacao> | null;
      if (v && typeof v.assinatura === "string" && (v.estado === "lida" || v.estado === "excluida")) {
        estados[tipo] = { assinatura: v.assinatura, estado: v.estado };
      }
    }
    return estados;
  } catch {
    return {};
  }
}

function salvarEstados(estados: Estados) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estados));
  } catch {
    // Modo privado ou storage bloqueado — o estado vale só até recarregar.
  }
}

type Confirmacao = { tipo: "uma"; grupo: NotificacaoSinoGrupo } | { tipo: "todas" } | null;

export function SinoNotificacoes({ grupos }: { grupos: NotificacaoSinoGrupo[] }) {
  const [estados, setEstados] = useState<Estados>({});
  // Só mostra o contador depois de ler o localStorage — antes disso todas
  // pareceriam não lidas e o número "piscaria" na hidratação.
  const [carregado, setCarregado] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);

  useEffect(() => {
    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect); localStorage só existe no client.
    queueMicrotask(() => {
      setEstados(lerEstados());
      setCarregado(true);
    });
  }, []);

  function situacao(grupo: NotificacaoSinoGrupo): "nao_lida" | "lida" | "excluida" {
    const salvo = estados[grupo.tipo];
    if (!salvo || salvo.assinatura !== assinatura(grupo)) return "nao_lida";
    return salvo.estado === "lida" ? "lida" : "excluida";
  }

  function atualizar(alvos: NotificacaoSinoGrupo[], estado: "lida" | "excluida") {
    setEstados((anterior) => {
      const proximo = { ...anterior };
      for (const grupo of alvos) proximo[grupo.tipo] = { assinatura: assinatura(grupo), estado };
      salvarEstados(proximo);
      return proximo;
    });
  }

  const visiveis = carregado ? grupos.filter((grupo) => situacao(grupo) !== "excluida") : grupos;
  const naoLidas = visiveis.filter((grupo) => situacao(grupo) === "nao_lida");

  function confirmarExclusao() {
    if (confirmacao?.tipo === "uma") atualizar([confirmacao.grupo], "excluida");
    if (confirmacao?.tipo === "todas") atualizar(visiveis, "excluida");
    setConfirmacao(null);
  }

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
              aria-label={naoLidas.length > 0 ? `Notificações (${naoLidas.length} não lidas)` : "Notificações"}
            >
              <Bell />
              {carregado && naoLidas.length > 0 && (
                <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white">
                  {naoLidas.length > 99 ? "99+" : naoLidas.length}
                </span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-80">
          {visiveis.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma notificação pendente.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 border-b pb-2">
                <span className="text-sm font-medium">
                  Notificações
                  {naoLidas.length > 0 && <span className="text-muted-foreground ml-1 text-xs">({naoLidas.length} não lidas)</span>}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={naoLidas.length === 0}
                    onClick={() => atualizar(naoLidas, "lida")}
                  >
                    <CheckCheck />
                    Marcar todas como lidas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive"
                    onClick={() => setConfirmacao({ tipo: "todas" })}
                  >
                    <Trash2 />
                    Excluir todas
                  </Button>
                </div>
              </div>

              {visiveis.map((grupo) => {
                const naoLida = situacao(grupo) === "nao_lida";
                return (
                  <div key={grupo.tipo} className="-mx-2 flex items-start gap-1 rounded-md px-2 py-1.5">
                    <Link
                      href={grupo.href}
                      onClick={() => atualizar([grupo], "lida")}
                      className="hover:bg-accent/50 flex min-w-0 flex-1 flex-col gap-1 rounded-md px-1 py-0.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex items-center gap-1.5 text-sm ${naoLida ? "font-semibold" : "text-muted-foreground font-medium"}`}>
                          {naoLida && <span aria-hidden className="bg-primary size-1.5 shrink-0 rounded-full" />}
                          {grupo.titulo}
                        </span>
                        <span className="text-muted-foreground text-xs">{grupo.quantidade}</span>
                      </div>
                      {grupo.itens && grupo.itens.length > 0 && (
                        <ul className="text-muted-foreground list-disc pl-4 text-xs">
                          {grupo.itens.slice(0, 5).map((item, indice) => (
                            <li key={indice}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </Link>
                    <div className="flex shrink-0 flex-col">
                      {naoLida && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Marcar como lida"
                          title="Marcar como lida"
                          onClick={() => atualizar([grupo], "lida")}
                        >
                          <Check />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive"
                        aria-label="Excluir notificação"
                        title="Excluir"
                        onClick={() => setConfirmacao({ tipo: "uma", grupo })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmacao !== null} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacao?.tipo === "todas" ? "Excluir todas as notificações" : "Excluir notificação"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === "todas"
                ? `Remover as ${visiveis.length} notificações do sino? `
                : `Remover "${confirmacao?.grupo.titulo}" do sino? `}
              Elas refletem pendências reais do sistema, então só ficam ocultas neste navegador: voltam a aparecer se a
              situação mudar (por exemplo, mais parcelas em atraso).
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
