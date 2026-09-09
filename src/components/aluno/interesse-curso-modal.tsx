"use client";

import { useState, useTransition } from "react";
import { demonstrarInteresse } from "@/app/aluno/actions";
import { CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import type { CursoBloqueado } from "@/components/aluno/curso-bloqueado-card";
import { Capa } from "@/components/aluno/capa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function InteresseCursoModal({
  open,
  onOpenChange,
  curso,
  alunoId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curso: CursoBloqueado;
  alunoId: string;
}) {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) {
      setEnviado(false);
      setError(null);
    }
  }

  function handleInteresse() {
    setError(null);
    startTransition(async () => {
      const resultado = await demonstrarInteresse(curso.id, alunoId);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setEnviado(true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{curso.nome}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Capa capaUrl={curso.capaUrl} nome={curso.nome} aspect="16/9" className="w-full" />
          <Badge variant="secondary" className="w-fit">
            {CURSO_TIPO_LABELS[curso.tipo]}
          </Badge>
          {curso.descricao && <p className="text-muted-foreground text-sm">{curso.descricao}</p>}

          {enviado ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✅ Interesse registrado! Em breve entraremos em contato.
            </p>
          ) : (
            <p className="text-sm">
              Quer se matricular neste curso? Demonstre seu interesse e entraremos em contato!
            </p>
          )}

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          {enviado ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={handleInteresse}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {isPending ? "Enviando..." : "✋ Tenho interesse!"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
