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

export function CursoBloqueadoCard({ curso, alunoId }: { curso: CursoBloqueado; alunoId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group text-left">
        <Card className="gap-0 overflow-hidden py-0 transition duration-300 hover:shadow-lg hover:shadow-foreground/10">
          <div className="relative">
            <Capa
              capaUrl={curso.capaUrl}
              nome={curso.nome}
              className="w-full rounded-none transition-transform duration-300 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Lock className="size-8 text-white" />
            </div>
            <Badge className="absolute top-2 right-2 bg-green-500/90 text-white">Disponível</Badge>
          </div>
          <CardContent className="flex flex-col gap-2 p-3">
            <h3 className="line-clamp-2 text-sm font-medium">{curso.nome}</h3>
            <Badge variant="secondary" className="w-fit text-xs">
              {CURSO_TIPO_LABELS[curso.tipo]}
            </Badge>
          </CardContent>
        </Card>
      </button>

      <InteresseCursoModal open={open} onOpenChange={setOpen} curso={curso} alunoId={alunoId} />
    </>
  );
}
