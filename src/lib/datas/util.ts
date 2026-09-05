import { DIAS_SEMANA } from "@/lib/turmas/schema";

export type DiaSemana = (typeof DIAS_SEMANA)[number];

// Todas as funções aqui trabalham com strings "YYYY-MM-DD" (sem hora) e usam
// Date.UTC pra montar/ler a data — evita o desvio de fuso de construir
// `new Date(stringPura)` ou ler `.getDay()` direto, que ficam sujeitos ao
// fuso local do processo Node (mesmo cuidado documentado em formatDataBR,
// espalhado pelas tabelas do admin).
export function adicionarDias(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

const ISO_DOW_PARA_DIA_SEMANA: DiaSemana[] = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];

export function diaDaSemana(dataISO: string): DiaSemana {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return ISO_DOW_PARA_DIA_SEMANA[dow];
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const OFFSET_PARA_SEGUNDA: Record<DiaSemana, number> = {
  domingo: -6,
  segunda: 0,
  terca: -1,
  quarta: -2,
  quinta: -3,
  sexta: -4,
  sabado: -5,
};

// Segunda-feira da semana que contém dataISO — usado como âncora da
// navegação por semana da tela de Cronograma.
export function segundaDaSemana(dataISO: string): string {
  return adicionarDias(dataISO, OFFSET_PARA_SEGUNDA[diaDaSemana(dataISO)]);
}
