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

// Cria/atualiza eventos do tipo 'feriado' com origem='api' a partir dos
// feriados nacionais do ano informado. Upsert por (nome, data_inicio) —
// ver índice parcial eventos_calendario_feriado_api_uidx (só entre linhas
// origem='api') — pra rodar a sincronização de novo no mesmo ano não duplicar
// linhas. Chamada só sob ação explícita do admin (nunca automática).
export async function sincronizarFeriados(ano: number): Promise<number> {
  const feriados = await buscarFeriadosBrasilAPI(ano);
  if (feriados.length === 0) return 0;

  const supabase = await createClient();
  const { error } = await supabase.from("eventos_calendario").upsert(
    feriados.map((feriado) => ({
      nome: feriado.name,
      tipo: "feriado" as const,
      tipo_feriado: "nacional" as const,
      data_inicio: feriado.date,
      data_fim: feriado.date,
      abrangencia: "todos" as const,
      origem: "api" as const,
    })),
    { onConflict: "nome,data_inicio" },
  );

  if (error) {
    throw new Error("Falha ao sincronizar feriados com o banco.");
  }

  return feriados.length;
}
