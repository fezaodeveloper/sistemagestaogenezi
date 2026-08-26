import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FeriadoAPI } from "@/lib/calendario/schema";

const BRASIL_API_FERIADOS_URL = "https://brasilapi.com.br/api/feriados/v1";

// Endpoint público da BrasilAPI, sem autenticação — mesma filosofia do
// ViaCEP já usado no cadastro de aluno (src/components/admin/aluno-create-form.tsx).
// Nunca lança: qualquer falha (rede, resposta não-2xx, formato inesperado)
// vira lista vazia, e quem chama decide o que fazer com "0 feriados".
export async function buscarFeriadosBrasilAPI(ano: number): Promise<FeriadoAPI[]> {
  try {
    const response = await fetch(`${BRASIL_API_FERIADOS_URL}/${ano}`);
    if (!response.ok) return [];

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as FeriadoAPI[]) : [];
  } catch {
    return [];
  }
}

// Cria eventos do tipo 'feriado' com origem='api' a partir dos feriados
// nacionais do ano informado. Dedup feito em duas consultas (select do que
// já existe + insert só do que falta) em vez de upsert com onConflict: o
// Supabase (PostgREST) não resolve onConflict contra um índice único
// parcial (eventos_calendario_feriado_api_uidx é `where origem = 'api'`) —
// o upsert simplesmente não encontrava o conflito e falhava silenciosamente
// (nem inseria, nem atualizava, nem retornava erro tratável). O índice em si
// continua útil como rede de segurança no banco contra corrida entre duas
// sincronizações simultâneas; só a estratégia de escrita do app mudou.
// Chamada só sob ação explícita do admin (nunca automática).
export async function sincronizarFeriados(ano: number): Promise<number> {
  const feriados = await buscarFeriadosBrasilAPI(ano);
  if (feriados.length === 0) return 0;

  const supabase = await createClient();

  const { data: existentes, error: erroConsulta } = await supabase
    .from("eventos_calendario")
    .select("nome, data_inicio")
    .eq("origem", "api")
    .gte("data_inicio", `${ano}-01-01`)
    .lte("data_inicio", `${ano}-12-31`);

  if (erroConsulta) {
    throw new Error("Falha ao consultar feriados já sincronizados.");
  }

  const chavesExistentes = new Set(
    (existentes ?? []).map((evento) => `${evento.nome}|${evento.data_inicio}`),
  );
  const feriadosNovos = feriados.filter(
    (feriado) => !chavesExistentes.has(`${feriado.name}|${feriado.date}`),
  );

  if (feriadosNovos.length === 0) return 0;

  const { error: erroInsert } = await supabase.from("eventos_calendario").insert(
    feriadosNovos.map((feriado) => ({
      nome: feriado.name,
      tipo: "feriado" as const,
      tipo_feriado: "nacional" as const,
      data_inicio: feriado.date,
      data_fim: feriado.date,
      abrangencia: "todos" as const,
      origem: "api" as const,
    })),
  );

  if (erroInsert) {
    throw new Error("Falha ao sincronizar feriados com o banco.");
  }

  return feriadosNovos.length;
}
