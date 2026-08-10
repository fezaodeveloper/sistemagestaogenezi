import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlunoEditForm } from "@/components/admin/aluno-edit-form";
import { MatriculasSection } from "@/components/admin/matriculas-section";
import { LiberacoesManuaisSection } from "@/components/admin/liberacoes-manuais-section";
import type { AlunoWithRelations, Responsavel } from "@/lib/alunos/schema";
import type { MatriculaWithTurma } from "@/lib/matriculas/schema";

type MatriculaComCurso = MatriculaWithTurma & {
  turmas: { nome: string; curso_id: string; cursos: { nome: string } | null } | null;
};

type ModuloComAulasRow = {
  id: string;
  numero: number;
  titulo: string;
  curso_id: string;
  aulas: { id: string; numero: number; titulo: string }[] | null;
};

type LiberacaoRow = {
  id: string;
  matricula_id: string;
  aula_id: string;
  created_at: string;
  aulas: {
    numero: number;
    titulo: string;
    modulos: { numero: number; titulo: string; curso_id: string } | null;
  } | null;
};

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [
    { data: alunoData },
    { data: responsavelData },
    { data: matriculasData },
    { data: turmasData },
  ] = await Promise.all([
    supabase.from("alunos").select("*, profiles!alunos_id_fkey(full_name)").eq("id", id).single(),
    supabase.from("responsaveis").select("*").eq("aluno_id", id).maybeSingle(),
    supabase
      .from("matriculas")
      .select("*, turmas(nome, curso_id, cursos(nome))")
      .eq("aluno_id", id)
      .order("created_at", { ascending: false }),
    // Só turmas que ainda fazem sentido pra receber uma matrícula nova —
    // não filtra na edição de uma matrícula já existente.
    supabase.from("turmas").select("id, nome").in("status", ["planejada", "ativa"]).order("nome"),
  ]);
  const aluno = alunoData as AlunoWithRelations | null;
  const responsavel = responsavelData as Responsavel | null;
  const matriculas = (matriculasData as MatriculaComCurso[] | null) ?? [];

  if (!aluno) {
    notFound();
  }

  // Um curso por matrícula (a mais recente, já que matriculas vem ordenada
  // por created_at desc) — usada tanto pro Select de curso quanto pra
  // resolver qual matricula_id usar ao liberar algo nesse curso.
  const cursoOptionsMap = new Map<string, { id: string; nome: string; matriculaId: string }>();
  for (const m of matriculas) {
    const cursoId = m.turmas?.curso_id;
    if (cursoId && !cursoOptionsMap.has(cursoId)) {
      cursoOptionsMap.set(cursoId, {
        id: cursoId,
        nome: m.turmas?.cursos?.nome ?? "Curso",
        matriculaId: m.id,
      });
    }
  }
  const cursoOptions = [...cursoOptionsMap.values()];
  const cursoIds = cursoOptions.map((c) => c.id);
  const matriculaIds = matriculas.map((m) => m.id);

  const [{ data: modulosData }, { data: liberacoesData }] = await Promise.all([
    cursoIds.length > 0
      ? supabase
          .from("modulos")
          .select("id, numero, titulo, curso_id, aulas(id, numero, titulo)")
          .in("curso_id", cursoIds)
          .order("numero")
          .order("numero", { referencedTable: "aulas" })
      : Promise.resolve({ data: [] as ModuloComAulasRow[] }),
    matriculaIds.length > 0
      ? supabase
          .from("liberacoes_manuais")
          .select(
            "id, matricula_id, aula_id, created_at, aulas(numero, titulo, modulos(numero, titulo, curso_id))",
          )
          .in("matricula_id", matriculaIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as LiberacaoRow[] }),
  ]);

  const modulosOptions = ((modulosData ?? []) as unknown as ModuloComAulasRow[]).map((m) => ({
    id: m.id,
    numero: m.numero,
    titulo: m.titulo,
    cursoId: m.curso_id,
    aulas: (m.aulas ?? []).sort((a, b) => a.numero - b.numero),
  }));

  const cursoNomeById = new Map(cursoOptions.map((c) => [c.id, c.nome]));
  const liberacoesExistentes = ((liberacoesData ?? []) as unknown as LiberacaoRow[])
    .filter((l) => l.aulas?.modulos)
    .map((l) => ({
      id: l.id,
      aulaId: l.aula_id,
      cursoNome: cursoNomeById.get(l.aulas!.modulos!.curso_id) ?? "Curso",
      moduloNumero: l.aulas!.modulos!.numero,
      moduloTitulo: l.aulas!.modulos!.titulo,
      aulaNumero: l.aulas!.numero,
      aulaTitulo: l.aulas!.titulo,
      createdAt: l.created_at,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar aluno</h1>
        <p className="text-muted-foreground text-sm">{aluno.profiles?.full_name ?? aluno.email}</p>
      </div>
      <AlunoEditForm
        id={aluno.id}
        defaultValues={{
          full_name: aluno.profiles?.full_name ?? "",
          cpf: aluno.cpf,
          telefone: aluno.telefone,
          endereco: aluno.endereco ?? "",
          data_nascimento: aluno.data_nascimento,
          responsavel_nome: responsavel?.nome,
          responsavel_cpf: responsavel?.cpf,
          responsavel_telefone: responsavel?.telefone,
        }}
      />
      <MatriculasSection
        alunoId={aluno.id}
        matriculas={matriculas}
        turmasDisponiveis={turmasData ?? []}
      />
      <LiberacoesManuaisSection
        alunoId={aluno.id}
        cursos={cursoOptions}
        modulos={modulosOptions}
        liberacoes={liberacoesExistentes}
      />
    </div>
  );
}
