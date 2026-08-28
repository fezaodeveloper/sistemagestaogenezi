import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";
import { parsePaginacao } from "@/lib/api/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type PresencaRow = {
  id: string;
  data: string;
  status: string;
  justificativa: string | null;
  matriculas: { alunos: { profiles: { full_name: string | null } | null } | null; turmas: { nome: string } | null } | null;
  aulas: { titulo: string } | null;
};

export async function GET(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);
  if (!auth.permissoes.includes("presencas")) {
    return respostaErro("Esta API Key não tem permissão para o recurso 'presencas'.", 403);
  }

  const url = new URL(request.url);
  const turmaId = url.searchParams.get("turma_id");
  const alunoId = url.searchParams.get("aluno_id");
  const dataInicio = url.searchParams.get("data_inicio");
  const dataFim = url.searchParams.get("data_fim");
  const { limit, offset } = parsePaginacao(url);

  const admin = createAdminClient();
  // matriculas!inner pra permitir filtrar por matriculas.turma_id/aluno_id
  // (mesmo padrão usado em src/app/admin/actions.ts, buscarGlobal).
  let query = admin
    .from("presencas")
    .select(
      "id, data, status, justificativa, matriculas!inner(aluno_id, turma_id, alunos(profiles!alunos_id_fkey(full_name)), turmas(nome)), aulas(titulo)",
      { count: "exact" },
    )
    .order("data", { ascending: false })
    .range(offset, offset + limit - 1);

  if (turmaId) query = query.eq("matriculas.turma_id", turmaId);
  if (alunoId) query = query.eq("matriculas.aluno_id", alunoId);
  if (dataInicio) query = query.gte("data", dataInicio);
  if (dataFim) query = query.lte("data", dataFim);

  const { data, count, error } = await query;
  if (error) return respostaErro("Não foi possível consultar as presenças.", 500);

  const presencas = ((data ?? []) as unknown as PresencaRow[]).map((presenca) => ({
    id: presenca.id,
    aluno_nome: presenca.matriculas?.alunos?.profiles?.full_name ?? null,
    turma_nome: presenca.matriculas?.turmas?.nome ?? null,
    aula_titulo: presenca.aulas?.titulo ?? null,
    data: presenca.data,
    status: presenca.status,
    justificativa: presenca.justificativa,
  }));

  return Response.json({ data: presencas, total: count ?? presencas.length, limit, offset });
}
