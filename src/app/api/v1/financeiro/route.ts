import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";
import { parsePaginacao } from "@/lib/api/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type ParcelaRow = {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  alunos: { profiles: { full_name: string | null } | null } | null;
  matriculas: { turmas: { cursos: { nome: string } | null } | null } | null;
};

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

export async function GET(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);
  if (!auth.permissoes.includes("financeiro")) {
    return respostaErro("Esta API Key não tem permissão para o recurso 'financeiro'.", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const alunoId = url.searchParams.get("aluno_id");
  const mes = url.searchParams.get("mes");
  const ano = url.searchParams.get("ano");
  const { limit, offset } = parsePaginacao(url);

  // Faixa de data_vencimento comum ao resumo (pendente/pago/atrasado,
  // sempre nos três) e à lista paginada de parcelas — null quando
  // mes/ano não foram informados (sem filtro de data).
  let dataInicio: string | null = null;
  let dataFim: string | null = null;
  if (ano && mes) {
    dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
    dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  } else if (ano) {
    dataInicio = `${ano}-01-01`;
    dataFim = `${ano}-12-31`;
  }

  const admin = createAdminClient();

  function baseQuery(colunas: string) {
    let query = admin.from("parcelas").select(colunas);
    if (alunoId) query = query.eq("aluno_id", alunoId);
    if (dataInicio && dataFim) query = query.gte("data_vencimento", dataInicio).lte("data_vencimento", dataFim);
    return query;
  }

  const [{ data: pendentesData }, { data: pagasData }, { data: atrasadasData }] = await Promise.all([
    baseQuery("valor").eq("status", "pendente"),
    baseQuery("valor").eq("status", "pago"),
    baseQuery("valor").eq("status", "atrasado"),
  ]);

  const resumo = {
    total_receber: somarValores(pendentesData as { valor: number }[] | null),
    total_recebido: somarValores(pagasData as { valor: number }[] | null),
    total_atrasado: somarValores(atrasadasData as { valor: number }[] | null),
  };

  let listaQuery = baseQuery(
    "id, numero_parcela, valor, data_vencimento, data_pagamento, status, alunos(profiles!alunos_id_fkey(full_name)), matriculas(turmas(cursos(nome)))",
  )
    .order("data_vencimento", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) listaQuery = listaQuery.eq("status", status);

  const { data, error } = await listaQuery;
  if (error) return respostaErro("Não foi possível consultar o financeiro.", 500);

  const parcelas = ((data ?? []) as unknown as ParcelaRow[]).map((parcela) => ({
    id: parcela.id,
    aluno_nome: parcela.alunos?.profiles?.full_name ?? null,
    curso_nome: parcela.matriculas?.turmas?.cursos?.nome ?? null,
    numero_parcela: parcela.numero_parcela,
    valor: parcela.valor,
    data_vencimento: parcela.data_vencimento,
    status: parcela.status,
    data_pagamento: parcela.data_pagamento,
  }));

  return Response.json({ resumo, parcelas });
}
