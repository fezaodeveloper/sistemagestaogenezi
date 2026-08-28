"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type BuscaGlobalAluno = { id: string; nome: string; email: string; cpf: string };
export type BuscaGlobalMatricula = { id: string; alunoNome: string; cursoNome: string };
export type BuscaGlobalCurso = { id: string; nome: string };

export type BuscaGlobalResultado = {
  alunos: BuscaGlobalAluno[];
  matriculas: BuscaGlobalMatricula[];
  cursos: BuscaGlobalCurso[];
};

const RESULTADO_VAZIO: BuscaGlobalResultado = { alunos: [], matriculas: [], cursos: [] };

// Busca global do header/dashboard do admin. Só roda com 3+ caracteres (o
// client já gate-keepa isso antes de chamar, mas a action se protege de
// novo — é um endpoint alcançável por POST direto). Vírgulas e parênteses
// são removidos do termo porque quebrariam a sintaxe do filtro .or() do
// PostgREST (usado só na busca de alunos, que combina 3 colunas).
export async function buscarGlobal(query: string): Promise<BuscaGlobalResultado> {
  await requireRole("admin");

  const termo = query.trim().replace(/[,()]/g, "");
  if (termo.length < 3) {
    return RESULTADO_VAZIO;
  }

  const supabase = await createClient();
  const padrao = `%${termo}%`;

  const [{ data: alunosData }, { data: matriculasData }, { data: cursosData }] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, full_name, email, cpf")
      .or(`full_name.ilike.${padrao},cpf.ilike.${padrao},email.ilike.${padrao}`)
      .limit(3),
    supabase
      .from("matriculas")
      .select("id, alunos!inner(full_name), turmas(nome, cursos(nome))")
      .ilike("alunos.full_name", padrao)
      .limit(3),
    supabase.from("cursos").select("id, nome").ilike("nome", padrao).limit(3),
  ]);

  const alunos = ((alunosData ?? []) as { id: string; full_name: string | null; email: string; cpf: string }[]).map(
    (aluno) => ({ id: aluno.id, nome: aluno.full_name ?? "—", email: aluno.email, cpf: aluno.cpf }),
  );

  const matriculas = (
    (matriculasData ?? []) as unknown as {
      id: string;
      alunos: { full_name: string | null } | null;
      turmas: { nome: string; cursos: { nome: string } | null } | null;
    }[]
  ).map((matricula) => ({
    id: matricula.id,
    alunoNome: matricula.alunos?.full_name ?? "—",
    cursoNome: matricula.turmas?.cursos?.nome ?? "—",
  }));

  const cursos = ((cursosData ?? []) as { id: string; nome: string }[]).map((curso) => ({
    id: curso.id,
    nome: curso.nome,
  }));

  return { alunos, matriculas, cursos };
}
