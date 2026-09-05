import { requireRole } from "@/lib/auth/dal";
import { getCronogramaSemana, getTurmasParaCronograma } from "@/app/admin/cronograma/actions";
import { CronogramaView } from "@/components/admin/cronograma-view";
import { hojeISO, segundaDaSemana } from "@/lib/datas/util";

export default async function CronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ turma_id?: string; semana?: string }>;
}) {
  await requireRole("admin");
  const { turma_id, semana } = await searchParams;

  const semanaInicio = segundaDaSemana(semana || hojeISO());

  const [turmas, cronograma] = await Promise.all([
    getTurmasParaCronograma(),
    getCronogramaSemana({ turmaId: turma_id || undefined, inicio: semanaInicio }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cronograma de Aulas</h1>
        <p className="text-muted-foreground text-sm">
          Datas previstas de cada aula, distribuídas pela cadência semanal de cada turma.
        </p>
      </div>
      <CronogramaView
        turmas={turmas}
        cronograma={cronograma}
        turmaIdSelecionada={turma_id ?? ""}
        semanaInicio={semanaInicio}
      />
    </div>
  );
}
