"use client";

// "use client": estado do diálogo de detalhe (clique numa conquista desbloqueada).

import { useState } from "react";
import { formatarData, type ConquistaAlunoView } from "@/lib/conquistas/tipos";
import { ConquistaBadgeImagem } from "@/components/aluno/conquista-badge-imagem";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ConquistasGrid({ conquistas }: { conquistas: ConquistaAlunoView[] }) {
  const [aberta, setAberta] = useState<ConquistaAlunoView | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {conquistas.map((c) => {
          const desbloqueada = c.desbloqueadaEm !== null;
          const conteudo = (
            <>
              <ConquistaBadgeImagem url={c.badgeUrl} emoji={c.badgeEmoji} titulo={c.titulo} bloqueada={!desbloqueada} />
              <span className={`text-sm font-medium break-words ${desbloqueada ? "" : "text-muted-foreground"}`}>{c.titulo}</span>
              <span className="text-muted-foreground text-xs break-words">
                {desbloqueada ? formatarData(c.desbloqueadaEm!) : c.comoDesbloquear}
              </span>
            </>
          );
          return (
            <li key={c.id}>
              {desbloqueada ? (
                <button
                  type="button"
                  onClick={() => setAberta(c)}
                  className="bg-card hover:bg-accent/40 flex h-full w-full flex-col items-center gap-2 rounded-xl border border-amber-500/30 p-4 text-center transition-colors"
                >
                  {conteudo}
                </button>
              ) : (
                <div className="bg-card/50 flex h-full w-full flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center">
                  {conteudo}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={aberta !== null} onOpenChange={(aberto) => !aberto && setAberta(null)}>
        <DialogContent>
          {aberta && (
            <>
              <DialogHeader className="items-center text-center">
                <div className="mx-auto">
                  <ConquistaBadgeImagem url={aberta.badgeUrl} emoji={aberta.badgeEmoji} titulo={aberta.titulo} className="size-28 text-6xl" />
                </div>
                <DialogTitle className="text-center break-words">{aberta.titulo}</DialogTitle>
                {aberta.descricao && (
                  <DialogDescription className="text-center break-words">{aberta.descricao}</DialogDescription>
                )}
              </DialogHeader>
              {aberta.desbloqueadaEm && (
                <p className="text-center text-sm text-amber-500">Desbloqueada em {formatarData(aberta.desbloqueadaEm)}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
