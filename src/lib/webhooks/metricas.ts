import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MetricasWebhooks = {
  enviados: number;
  entregues: number;
  falharam: number;
  // Ainda com tentativas em andamento.
  pendentes: number;
  // Preenchido se a tabela não pôde ser lida (ex.: migration pendente).
  erro: string | null;
};

// Métricas das últimas 24h (webhooks_log): "enviados" = todo disparo registrado.
export async function getMetricasWebhooks24h(supabase: SupabaseServerClient): Promise<MetricasWebhooks> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const contar = (status?: string) => {
    let consulta = supabase.from("webhooks_log").select("id", { count: "exact", head: true }).gte("created_at", desde);
    if (status) consulta = consulta.eq("status", status);
    return consulta;
  };

  const [total, entregues, falharam, pendentes] = await Promise.all([
    contar(),
    contar("entregue"),
    contar("falhou"),
    contar("pendente"),
  ]);

  const erro = total.error ?? entregues.error ?? falharam.error ?? pendentes.error;
  return {
    enviados: total.count ?? 0,
    entregues: entregues.count ?? 0,
    falharam: falharam.count ?? 0,
    pendentes: pendentes.count ?? 0,
    erro: erro ? erro.message : null,
  };
}

export function percentual(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : "—";
}
