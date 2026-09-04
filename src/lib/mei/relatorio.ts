import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export type RelatorioMEI = {
  cnpj: string;
  nomeEmpreendedor: string;
  periodoApuracao: string;

  comercioSemNota: number;
  comercioComNota: number;
  totalComercio: number;

  industriaSemNota: number;
  industriaComNota: number;
  totalIndustria: number;

  servicosSemNota: number;
  servicosComNota: number;
  totalServicos: number;

  totalGeral: number;
};

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

function ultimoDiaDoMesStr(ano: number, mes: number): string {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

// Comércio e indústria são sempre zero: a escola só presta serviços
// educacionais (Seção VII/VIII do relatório MEI) — as seções ficam aqui só
// pra manter o layout fiel ao modelo oficial do relatório mensal de receitas
// brutas do MEI.
export async function calcularRelatorioMEI(
  ano: number,
  mes: number,
  supabase: SupabaseServerClient,
): Promise<RelatorioMEI> {
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = ultimoDiaDoMesStr(ano, mes);

  const [{ data: configuracoes }, { data: parcelasPagas }, { data: avulsos }] = await Promise.all([
    supabase.from("configuracoes").select("escola_cnpj, escola_nome").eq("id", true).single(),
    supabase
      .from("parcelas")
      .select("valor, nota_fiscal_emitida")
      .eq("status", "pago")
      .gte("data_pagamento", inicioMes)
      .lte("data_pagamento", fimMes),
    supabase.from("pagamentos_avulsos").select("valor").gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes),
  ]);

  const parcelas = (parcelasPagas ?? []) as { valor: number; nota_fiscal_emitida: boolean }[];

  // Pagamentos avulsos não têm campo de controle de nota fiscal — entram
  // inteiramente em "sem nota" (ver src/lib/financeiro/schema.ts).
  const servicosSemNota =
    somarValores(parcelas.filter((parcela) => !parcela.nota_fiscal_emitida)) +
    somarValores(avulsos as { valor: number }[] | null);
  const servicosComNota = somarValores(parcelas.filter((parcela) => parcela.nota_fiscal_emitida));
  const totalServicos = servicosSemNota + servicosComNota;

  return {
    cnpj: configuracoes?.escola_cnpj ?? "—",
    nomeEmpreendedor: configuracoes?.escola_nome ?? "—",
    periodoApuracao: `${NOMES_MES[mes - 1]}/${ano}`,

    comercioSemNota: 0,
    comercioComNota: 0,
    totalComercio: 0,

    industriaSemNota: 0,
    industriaComNota: 0,
    totalIndustria: 0,

    servicosSemNota,
    servicosComNota,
    totalServicos,

    totalGeral: totalServicos,
  };
}
