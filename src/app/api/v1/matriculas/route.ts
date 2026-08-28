import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";
import { parsePaginacao } from "@/lib/api/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type MatriculaRow = {
  id: string;
  status: string;
  valor_final: number | null;
  num_parcelas: number | null;
  data_inicio: string;
  previsao_conclusao: string | null;
  created_at: string;
  alunos: { email: string; profiles: { full_name: string | null } | null } | null;
  turmas: { nome: string; cursos: { nome: string } | null } | null;
};

export async function GET(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);
  if (!auth.permissoes.includes("matriculas")) {
    return respostaErro("Esta API Key não tem permissão para o recurso 'matriculas'.", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const alunoId = url.searchParams.get("aluno_id");
  const { limit, offset } = parsePaginacao(url);

  const admin = createAdminClient();
  let query = admin
    .from("matriculas")
    .select(
      "id, status, valor_final, num_parcelas, data_inicio, previsao_conclusao, created_at, alunos(email, profiles!alunos_id_fkey(full_name)), turmas(nome, cursos(nome))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (alunoId) query = query.eq("aluno_id", alunoId);

  const { data, count, error } = await query;
  if (error) return respostaErro("Não foi possível consultar as matrículas.", 500);

  const matriculas = ((data ?? []) as unknown as MatriculaRow[]).map((matricula) => ({
    id: matricula.id,
    aluno_nome: matricula.alunos?.profiles?.full_name ?? null,
    aluno_email: matricula.alunos?.email ?? null,
    curso_nome: matricula.turmas?.cursos?.nome ?? null,
    turma_nome: matricula.turmas?.nome ?? null,
    status: matricula.status,
    valor_final: matricula.valor_final,
    num_parcelas: matricula.num_parcelas,
    data_inicio: matricula.data_inicio,
    previsao_conclusao: matricula.previsao_conclusao,
    created_at: matricula.created_at,
  }));

  return Response.json({ data: matriculas, total: count ?? matriculas.length, limit, offset });
}
