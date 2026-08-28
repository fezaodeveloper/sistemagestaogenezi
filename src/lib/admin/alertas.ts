import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AlertaDia = {
  chave: string;
  titulo: string;
  quantidade: number;
  href: string;
  cor: "amber" | "blue" | "red";
};

// Limiar de baixa ocupação: turma ativa com menos de 50% das vagas
// preenchidas entra no alerta.
const OCUPACAO_MINIMA = 0.5;

// Alertas operacionais do dia, exibidos em src/components/admin/alertas-dia.tsx.
// Cada item só entra na lista se houver algo para alertar (contagem > 0).
export async function getAlertasDia(supabase: SupabaseServerClient): Promise<AlertaDia[]> {
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: turmasData }, { count: eventosHojeCount }, { count: certificadosPendentes }, { count: parcelasAtrasadas }] =
    await Promise.all([
      supabase.from("turmas").select("capacidade_maxima, vagas_ocupadas").eq("status", "ativa"),
      supabase
        .from("eventos_calendario")
        .select("id", { count: "exact", head: true })
        .lte("data_inicio", hoje)
        .gte("data_fim", hoje),
      supabase.from("certificados").select("id", { count: "exact", head: true }).eq("liberado", false),
      supabase.from("parcelas").select("id", { count: "exact", head: true }).eq("status", "atrasado"),
    ]);

  const turmasBaixaOcupacao = (
    (turmasData ?? []) as { capacidade_maxima: number; vagas_ocupadas: number }[]
  ).filter((turma) => turma.capacidade_maxima > 0 && turma.vagas_ocupadas / turma.capacidade_maxima < OCUPACAO_MINIMA).length;

  const alertas: AlertaDia[] = [];

  if (turmasBaixaOcupacao > 0) {
    alertas.push({
      chave: "ocupacao",
      titulo: `${turmasBaixaOcupacao} turma${turmasBaixaOcupacao > 1 ? "s" : ""} com baixa ocupação`,
      quantidade: turmasBaixaOcupacao,
      href: "/admin/turmas",
      cor: "amber",
    });
  }

  if ((eventosHojeCount ?? 0) > 0) {
    alertas.push({
      chave: "eventos",
      titulo: `${eventosHojeCount} evento${(eventosHojeCount ?? 0) > 1 ? "s" : ""} hoje`,
      quantidade: eventosHojeCount ?? 0,
      href: "/admin/calendario",
      cor: "blue",
    });
  }

  if ((certificadosPendentes ?? 0) > 0) {
    alertas.push({
      chave: "certificados",
      titulo: `${certificadosPendentes} certificado${(certificadosPendentes ?? 0) > 1 ? "s" : ""} pendente${(certificadosPendentes ?? 0) > 1 ? "s" : ""}`,
      quantidade: certificadosPendentes ?? 0,
      href: "/admin/certificados",
      cor: "red",
    });
  }

  if ((parcelasAtrasadas ?? 0) > 0) {
    alertas.push({
      chave: "parcelas",
      titulo: `${parcelasAtrasadas} parcela${(parcelasAtrasadas ?? 0) > 1 ? "s" : ""} em atraso`,
      quantidade: parcelasAtrasadas ?? 0,
      href: "/admin/financeiro",
      cor: "red",
    });
  }

  return alertas;
}
