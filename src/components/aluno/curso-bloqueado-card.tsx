"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { CURSO_TIPO_LABELS, type CURSO_TIPOS } from "@/lib/cursos/schema";
import { Capa } from "@/components/aluno/capa";
import { InteresseCursoModal } from "@/components/aluno/interesse-curso-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type CursoBloqueado = {
  id: string;
  nome: string;
  tipo: (typeof CURSO_TIPOS)[number];
  capaUrl: string | null;
  descricao: string | null;
};

// Cartão inteiro continua sendo um único <button> (mesma lógica de sempre —
// clicar em qualquer parte abre o modal de interesse); o card só troca de
// "bloqueado" pra "disponível" via CSS puro (group-hover), sem estado extra
// no React. "Bloqueado"/"Disponível" e os dois textos do botão-visual usam
// o mesmo truque de crossfade (duas camadas absolutas, opacidade trocada no
// hover) — evita layout shift ao trocar o texto.
export function CursoBloqueadoCard({ curso, alunoId }: { curso: CursoBloqueado; alunoId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group block w-full text-left">
        <Card className="gap-0 overflow-hidden py-0 transition-all duration-300 ease-in-out group-hover:scale-105 group-hover:shadow-[0_0_24px_4px_rgba(34,211,238,0.35)]">
          <div className="relative aspect-video w-full overflow-hidden">
            <Capa
              capaUrl={curso.capaUrl}
              nome={curso.nome}
              aspect="16/9"
              className="h-full w-full rounded-none object-cover grayscale transition-all duration-300 ease-in-out group-hover:grayscale-0"
            />
            <div className="absolute inset-0 bg-black/60 transition-colors duration-300 ease-in-out group-hover:bg-black/30" />

            <div className="absolute inset-x-0 top-1/3 flex h-7 items-center justify-center">
              <span className="absolute flex items-center gap-1 rounded-full bg-red-500/90 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase transition-opacity duration-300 ease-in-out group-hover:opacity-0">
                <Lock className="size-3.5" />
                Bloqueado
              </span>
              <span className="absolute rounded-full bg-green-500/90 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
                Disponível
              </span>
            </div>

            <h3 className="absolute right-3 bottom-2 left-3 line-clamp-2 text-center text-base font-semibold text-white drop-shadow">
              {curso.nome}
            </h3>
          </div>
          <CardContent className="flex flex-col gap-3 p-4">
            <Badge variant="secondary" className="w-fit text-xs">
              {CURSO_TIPO_LABELS[curso.tipo]}
            </Badge>
            <div className="bg-muted text-muted-foreground relative flex h-9 items-center justify-center overflow-hidden rounded-md text-sm font-medium opacity-70 transition-all duration-300 ease-in-out group-hover:bg-green-600 group-hover:text-white group-hover:opacity-100">
              <span className="transition-opacity duration-300 ease-in-out group-hover:opacity-0">
                Tenho interesse
              </span>
              <span className="absolute opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
                ✋ Tenho interesse!
              </span>
            </div>
          </CardContent>
        </Card>
      </button>

      <InteresseCursoModal open={open} onOpenChange={setOpen} curso={curso} alunoId={alunoId} />
    </>
  );
}
