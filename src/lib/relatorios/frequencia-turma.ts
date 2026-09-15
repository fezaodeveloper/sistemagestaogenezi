import "server-only";

import { createClient } from "@/lib/supabase/server";

export type FrequenciaAlunoLinha = {
  nome: string;
  totalAulas: number;
  presencas: number;
  faltas: number;
  percentual: number;
  detalhes: { aulaTitulo: string; data: string; status: string }[];
};

export type FrequenciaTurmaDados = {
  escolaNome: string;
  cursoNome: string;
  turmaNome: string;
  periodo: string;
  alunos: FrequenciaAlunoLinha[];
  geradoEm: string;
};

const STATUS_LABELS: Record<string, string> = {
  presente: "Presente",
  falta: "Falta",
  justificada: "Justificada",
  reposicao: "Reposição",
};

function formatDateBR(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

type MatriculaRow = { id: string; alunos: { profiles: { full_name: string | null } | null } | null };
type PresencaRow = {
  matricula_id: string;
  aula_id: string;
  data: string;
  status: string;
  aulas: { titulo: string } | null;
};

// "Total de aulas" = aulas que já tiveram alguma chamada registrada nesta
// turma (o currículo pode ter aulas futuras cuja chamada ainda não foi
// feita) — mais fiel ao andamento real da turma do que contar todas as
// aulas do curso de uma vez.
export async function buscarDadosFrequenciaTurma(turmaId: string): Promise<FrequenciaTurmaDados | null> {
  const supabase = await createClient();

  const [{ data: turmaData }, { data: configData }] = await Promise.all([
    supabase.from("turmas").select("nome, data_inicio, data_fim, cursos(nome)").eq("id", turmaId).maybeSingle(),
    supabase.from("configuracoes").select("escola_nome").eq("id", true).maybeSingle(),
  ]);

  const turma = turmaData as unknown as {
    nome: string;
    data_inicio: string;
    data_fim: string;
    cursos: { nome: string } | null;
  } | null;

  if (!turma) return null;

  const [{ data: matriculasData }, { data: presencasData }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("id, alunos(profiles!alunos_id_fkey(full_name))")
      .eq("turma_id", turmaId)
      .eq("status", "ativa"),
    supabase
      .from("presencas")
      .select("matricula_id, aula_id, data, status, aulas(titulo), matriculas!inner(turma_id)")
      .eq("matriculas.turma_id", turmaId),
  ]);

  const matriculas = (matriculasData as unknown as MatriculaRow[] | null) ?? [];
  const presencas = (presencasData as unknown as PresencaRow[] | null) ?? [];

  const totalAulas = new Set(presencas.map((p) => p.aula_id)).size;

  const presencasPorMatricula = new Map<string, PresencaRow[]>();
  for (const presenca of presencas) {
    const lista = presencasPorMatricula.get(presenca.matricula_id) ?? [];
    lista.push(presenca);
    presencasPorMatricula.set(presenca.matricula_id, lista);
  }

  const alunos: FrequenciaAlunoLinha[] = matriculas
    .map((matricula) => {
      const nome = matricula.alunos?.profiles?.full_name ?? "—";
      const presencasAluno = presencasPorMatricula.get(matricula.id) ?? [];
      const presencasCount = presencasAluno.filter(
        (p) => p.status === "presente" || p.status === "reposicao",
      ).length;
      const faltasCount = presencasAluno.filter((p) => p.status === "falta").length;
      const percentual = totalAulas > 0 ? Math.round((presencasCount / totalAulas) * 100) : 0;

      return {
        nome,
        totalAulas,
        presencas: presencasCount,
        faltas: faltasCount,
        percentual,
        detalhes: presencasAluno
          .slice()
          .sort((a, b) => (a.data < b.data ? -1 : 1))
          .map((p) => ({
            aulaTitulo: p.aulas?.titulo ?? "—",
            data: formatDateBR(p.data),
            status: STATUS_LABELS[p.status] ?? p.status,
          })),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    escolaNome: configData?.escola_nome ?? "Gênezi Educação Profissional",
    cursoNome: turma.cursos?.nome ?? "—",
    turmaNome: turma.nome,
    periodo: `${formatDateBR(turma.data_inicio)} a ${formatDateBR(turma.data_fim)}`,
    alunos,
    geradoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  };
}
