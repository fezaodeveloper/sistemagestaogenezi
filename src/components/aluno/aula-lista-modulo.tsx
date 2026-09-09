import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AulaListaItem = {
  id: string;
  numero: number;
  titulo: string;
  concluida: boolean;
};

// Server Component (sem interatividade além de navegação nativa) — usado no
// player de aula (coluna direita) pra listar as aulas do módulo com status
// de conclusão. Barra de rolagem interna (max-h + overflow-y-auto) evita
// que módulos com muitas aulas estiquem a página.
export function AulaListaModulo({
  cursoId,
  moduloId,
  aulaAtualId,
  aulas,
}: {
  cursoId: string;
  moduloId: string;
  aulaAtualId?: string;
  aulas: AulaListaItem[];
}) {
  const concluidas = aulas.filter((aula) => aula.concluida).length;

  return (
    <div className="border-l-4 border-orange-500 bg-card overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <h2 className="text-sm font-semibold">Aulas do módulo</h2>
        <Badge variant="secondary">
          {concluidas}/{aulas.length}
        </Badge>
      </div>
      <div className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto p-2">
        {aulas.map((aula) => {
          const atual = aula.id === aulaAtualId;
          return (
            <Link
              key={aula.id}
              href={`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aula.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                atual ? "border-cyan-500 bg-cyan-500/10" : "border-transparent hover:bg-accent/50",
              )}
            >
              <span className="shrink-0">{aula.concluida ? "✅" : "⭕"}</span>
              <span className="truncate">
                {aula.numero}. {aula.titulo}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
