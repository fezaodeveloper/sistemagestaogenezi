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

// Dia da semana por extenso, em português ("Quarta-feira") — usado nas
// mensagens de agendamento do Telegram.
export const DIA_SEMANA_EXTENSO: Record<DiaSemana, string> = {
  domingo: "Domingo",
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
};

export function diaSemanaExtenso(dataISO: string): string {
  return DIA_SEMANA_EXTENSO[diaDaSemana(dataISO)];
}

// "Quarta-feira, 25/09/2026" a partir de "2026-09-25". Retorna "—" se a
// string não for uma data válida.
export function dataComDiaSemana(dataISO: unknown): string {
  if (typeof dataISO !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(dataISO)) return "—";
  const iso = dataISO.slice(0, 10);
  const [ano, mes, dia] = iso.split("-");
  return `${diaSemanaExtenso(iso)}, ${dia}/${mes}/${ano}`;
}

// Data (YYYY-MM-DD) e minutos desde 00:00 AGORA no horário de Brasília. As
// funções serverless da Vercel rodam em UTC, então getHours()/toISOString()
// dariam o horário/dia errado pra quem usa o sistema em Brasília.
export function agoraEmBrasilia(): { hoje: string; minutosDoDia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "0";
  return {
    hoje: `${valor("year")}-${valor("month")}-${valor("day")}`,
    minutosDoDia: Number(valor("hour")) * 60 + Number(valor("minute")),
  };
}
