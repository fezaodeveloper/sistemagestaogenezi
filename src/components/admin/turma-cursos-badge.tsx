import { resolverCursosDaTurma, type TurmaCursoVinculo } from "@/lib/turmas/schema";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// TAREFA múltiplos cursos por turma (PARTE 3) — mesmo cálculo/visual nos 3 lugares que hoje
// mostram "o curso da turma": lista de turmas, detalhe da turma e lista de matrículas. 1 curso =
// só o nome; 2+ = nome do principal + badge "+N cursos" com tooltip listando os demais.
export function TurmaCursosBadge({ vinculos }: { vinculos: TurmaCursoVinculo[] | null | undefined }) {
  const { nomePrincipal, outrosCursos } = resolverCursosDaTurma(vinculos);

  if (outrosCursos.length === 0) return <span>{nomePrincipal}</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      {nomePrincipal}
      <Tooltip>
        <TooltipTrigger render={<Badge variant="outline" className="cursor-default" />}>
          +{outrosCursos.length} curso{outrosCursos.length > 1 ? "s" : ""}
        </TooltipTrigger>
        <TooltipContent>{outrosCursos.join(", ")}</TooltipContent>
      </Tooltip>
    </span>
  );
}
