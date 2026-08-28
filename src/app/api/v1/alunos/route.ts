import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";
import { parsePaginacao } from "@/lib/api/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type AlunoRow = {
  id: string;
  email: string;
  cpf: string;
  telefone: string;
  status_aluno: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
  matriculas: { status: string; turmas: { nome: string } | null }[] | null;
};

export async function GET(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);
  if (!auth.permissoes.includes("alunos")) {
    return respostaErro("Esta API Key não tem permissão para o recurso 'alunos'.", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const { limit, offset } = parsePaginacao(url);

  const admin = createAdminClient();
  let query = admin
    .from("alunos")
    .select(
      "id, email, cpf, telefone, status_aluno, created_at, profiles!alunos_id_fkey(full_name), matriculas(status, turmas(nome))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status_aluno", status);

  const { data, count, error } = await query;
  if (error) return respostaErro("Não foi possível consultar os alunos.", 500);

  const alunos = ((data ?? []) as unknown as AlunoRow[]).map((aluno) => ({
    id: aluno.id,
    full_name: aluno.profiles?.full_name ?? null,
    email: aluno.email,
    cpf: aluno.cpf,
    telefone: aluno.telefone,
    status_aluno: aluno.status_aluno,
    turmas_ativas: (aluno.matriculas ?? [])
      .filter((matricula) => matricula.status === "ativa")
      .map((matricula) => matricula.turmas?.nome)
      .filter((nome): nome is string => Boolean(nome)),
    created_at: aluno.created_at,
  }));

  return Response.json({ data: alunos, total: count ?? alunos.length, limit, offset });
}
