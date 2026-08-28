import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type EventoRow = {
  id: string;
  nome: string;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  abrangencia: string;
  gera_notificacao: boolean;
};

export async function GET(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);
  if (!auth.permissoes.includes("eventos")) {
    return respostaErro("Esta API Key não tem permissão para o recurso 'eventos'.", 403);
  }

  const url = new URL(request.url);
  const dataInicio = url.searchParams.get("data_inicio");
  const dataFim = url.searchParams.get("data_fim");
  const tipo = url.searchParams.get("tipo");

  const admin = createAdminClient();
  let query = admin
    .from("eventos_calendario")
    .select("id, nome, tipo, data_inicio, data_fim, abrangencia, gera_notificacao", { count: "exact" })
    .order("data_inicio", { ascending: true });

  if (dataInicio) query = query.gte("data_inicio", dataInicio);
  if (dataFim) query = query.lte("data_fim", dataFim);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, count, error } = await query;
  if (error) return respostaErro("Não foi possível consultar os eventos.", 500);

  const eventos = ((data ?? []) as unknown as EventoRow[]).map((evento) => ({
    id: evento.id,
    nome: evento.nome,
    tipo: evento.tipo,
    data_inicio: evento.data_inicio,
    data_fim: evento.data_fim,
    abrangencia: evento.abrangencia,
    gera_notificacao: evento.gera_notificacao,
  }));

  return Response.json({ data: eventos, total: count ?? eventos.length });
}
