import { z } from "zod";

export const AGENDAMENTO_PAGINA_STATUSES = ["ativa", "inativa"] as const;
export type AgendamentoPaginaStatus = (typeof AGENDAMENTO_PAGINA_STATUSES)[number];

// Quantos dias à frente a página pública mostra/calcula disponibilidade
// (contagem de vagas ocupadas). Compartilhado entre o Server Component
// (/agendar/[slug]) e o calendário do client, que não deixa navegar além disso.
export const AGENDAMENTO_JANELA_DIAS = 90;

export const AGENDAMENTO_STATUSES = ["confirmado", "cancelado", "realizado", "faltou"] as const;
export type AgendamentoStatus = (typeof AGENDAMENTO_STATUSES)[number];

export const AGENDAMENTO_STATUS_LABELS: Record<AgendamentoStatus, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  realizado: "Realizado",
  faltou: "Faltou",
};

// Mesmo padrão de cores fixas via className usado em MATRICULA_STATUS_BADGE_CLASS.
export const AGENDAMENTO_STATUS_BADGE_CLASS: Record<AgendamentoStatus, string> = {
  confirmado: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  realizado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  faltou: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  cancelado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

// Feriados nacionais — fixos (data certa todo ano) + móveis, calculados a partir da Páscoa
// (algoritmo de Gauss/Butcher, válido pra qualquer ano do calendário gregoriano — não há
// biblioteca de feriados no projeto). Cobre só feriados NACIONAIS (não estaduais/municipais).
function dataISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somarDiasISO(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  // Meio-dia UTC: evita escorregar de dia por fuso (mesmo truque usado em todo o projeto, ex.
  // src/lib/whatsapp/eventos.ts::diaDaSemana).
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias, 12));
  return data.toISOString().slice(0, 10);
}

// Domingo de Páscoa do ano — algoritmo de Gauss/Butcher (anônimo gregoriano).
function calcularPascoaISO(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return dataISO(ano, mes, dia);
}

// Feriados nacionais de UM ano: fixos + móveis calculados a partir da Páscoa daquele ano.
export function feriadosNacionaisDoAno(ano: number): string[] {
  const pascoa = calcularPascoaISO(ano);
  return [
    dataISO(ano, 1, 1), // Confraternização universal
    somarDiasISO(pascoa, -48), // Carnaval (segunda)
    somarDiasISO(pascoa, -47), // Carnaval (terça)
    somarDiasISO(pascoa, -2), // Sexta-feira Santa
    dataISO(ano, 4, 21), // Tiradentes
    dataISO(ano, 5, 1), // Dia do Trabalho
    somarDiasISO(pascoa, 60), // Corpus Christi
    dataISO(ano, 9, 7), // Independência
    dataISO(ano, 10, 12), // Nossa Sra. Aparecida
    dataISO(ano, 11, 2), // Finados
    dataISO(ano, 11, 15), // Proclamação da República
    dataISO(ano, 11, 20), // Consciência Negra (nacional desde 2024)
    dataISO(ano, 12, 25), // Natal
  ].sort();
}

// TAREFA — PARTE 1: feriados pro período configurado na página (data_inicio/data_fim), não uma
// lista fixa de 1-2 anos hardcoded. Sem período definido, usa o ano atual + o próximo (nunca
// anos passados). Com período definido, calcula todos os anos que o período atravessa e filtra
// só as datas que caem dentro de [data_inicio, data_fim].
export function feriadosNacionaisParaPeriodo(dataInicio: string | null, dataFim: string | null): string[] {
  const anoAtual = new Date().getFullYear();
  if (!dataInicio && !dataFim) {
    return [...feriadosNacionaisDoAno(anoAtual), ...feriadosNacionaisDoAno(anoAtual + 1)].sort();
  }

  const anoInicio = dataInicio ? Number(dataInicio.slice(0, 4)) : anoAtual;
  const anoFim = dataFim ? Number(dataFim.slice(0, 4)) : anoInicio;

  const todos: string[] = [];
  for (let ano = anoInicio; ano <= anoFim; ano++) todos.push(...feriadosNacionaisDoAno(ano));

  return todos.filter((data) => (!dataInicio || data >= dataInicio) && (!dataFim || data <= dataFim)).sort();
}

// 0 = domingo, 6 = sábado — mesma convenção do Date.prototype.getDay().
export const DIA_SEMANA_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const horarioRegexSchema = z.string().regex(HORARIO_REGEX, { error: "Horário inválido (use HH:MM)." });

// TAREFA agendamentos — PARTE 2: formato novo é uma JANELA por dia (hora_inicio/hora_fim), que
// gera os horários individuais automaticamente (ver gerarSlotsDoDia). O formato antigo (um
// `horario` por entrada) continua aceito — RETROCOMPATIBILIDADE, sem migration de dado (ver
// 20261031300000_agendamento_horarios_janela.sql): páginas já criadas guardam entradas
// {dia_semana, horario} e continuam funcionando exatamente como antes, sem precisar editá-las.
export const horarioDisponivelSchema = z
  .object({
    dia_semana: z.number().int().min(0).max(6),
    horario: horarioRegexSchema.optional(),
    hora_inicio: horarioRegexSchema.optional(),
    hora_fim: horarioRegexSchema.optional(),
  })
  .refine((v) => !!v.horario || (!!v.hora_inicio && !!v.hora_fim), {
    error: "Informe um horário, ou uma janela com início e fim.",
  });
export type HorarioDisponivel = z.infer<typeof horarioDisponivelSchema>;

// Gera os horários concretos de UMA entrada: formato antigo devolve o próprio horário; janela
// nova gera os slots respeitando duração + intervalo (ex. tarefa: 08:00-12:00, 30min, 10min de
// intervalo => 08:00, 08:40, 09:20, 10:00, 10:40, 11:20 — 12:00 não entra porque o slot de 30min
// a partir de 12:00 terminaria depois do fim da janela).
export function gerarSlotsDoDia(entrada: HorarioDisponivel, duracaoMinutos: number, intervaloMinutos: number): string[] {
  if (entrada.horario) return [entrada.horario];
  if (!entrada.hora_inicio || !entrada.hora_fim) return [];

  const inicio = horarioParaMinutos(entrada.hora_inicio);
  const fim = horarioParaMinutos(entrada.hora_fim);
  const passo = duracaoMinutos + Math.max(0, intervaloMinutos);
  if (passo <= 0 || fim <= inicio) return [];

  const slots: string[] = [];
  for (let t = inicio; t + duracaoMinutos <= fim; t += passo) {
    const h = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const m = (t % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

// Achata horarios_disponiveis (mistura de entradas antigas e em janela) pro formato plano
// {dia_semana, horario}[] que todo o resto do código já espera (validarSlotPermitido, calendário
// público, reagendamento) — um único ponto de expansão, em vez de ensinar cada consumidor a
// entender os dois formatos.
export function expandirHorariosDisponiveis(
  horarios: HorarioDisponivel[],
  duracaoMinutos: number,
  intervaloMinutos: number,
): { dia_semana: number; horario: string }[] {
  const expandidos: { dia_semana: number; horario: string }[] = [];
  for (const entrada of horarios) {
    for (const horario of gerarSlotsDoDia(entrada, duracaoMinutos, intervaloMinutos)) {
      expandidos.push({ dia_semana: entrada.dia_semana, horario });
    }
  }
  return expandidos;
}

// ===== Aparência do formulário público (TAREFA — PARTE 4) =====

export const FONTES_AGENDAMENTO = ["Inter", "Roboto", "Poppins", "Georgia"] as const;
export type FonteAgendamento = (typeof FONTES_AGENDAMENTO)[number];

export const TAMANHOS_TITULO_AGENDAMENTO = ["xl", "2xl", "3xl", "4xl"] as const;
export type TamanhoTituloAgendamento = (typeof TAMANHOS_TITULO_AGENDAMENTO)[number];

export const TAMANHOS_SUBTITULO_AGENDAMENTO = ["sm", "base", "lg", "xl"] as const;
export type TamanhoSubtituloAgendamento = (typeof TAMANHOS_SUBTITULO_AGENDAMENTO)[number];

export const ALINHAMENTOS_AGENDAMENTO = ["left", "center", "right"] as const;
export type AlinhamentoAgendamento = (typeof ALINHAMENTOS_AGENDAMENTO)[number];

export const ARREDONDAMENTOS_BOTAO_AGENDAMENTO = ["none", "sm", "md", "lg", "full"] as const;
export type ArredondamentoBotaoAgendamento = (typeof ARREDONDAMENTOS_BOTAO_AGENDAMENTO)[number];

const corHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." });

export const configVisualSchema = z.object({
  cor_fundo: corHexSchema.optional(),
  cor_primaria: corHexSchema.optional(),
  cor_texto: corHexSchema.optional(),
  cor_texto_secundario: corHexSchema.optional(),
  fonte: z.enum(FONTES_AGENDAMENTO).optional(),
  titulo_tamanho: z.enum(TAMANHOS_TITULO_AGENDAMENTO).optional(),
  titulo_alinhamento: z.enum(ALINHAMENTOS_AGENDAMENTO).optional(),
  subtitulo_tamanho: z.enum(TAMANHOS_SUBTITULO_AGENDAMENTO).optional(),
  subtitulo_alinhamento: z.enum(ALINHAMENTOS_AGENDAMENTO).optional(),
  botao_texto: z.string().trim().max(60).optional(),
  botao_cor: corHexSchema.optional(),
  botao_cor_texto: corHexSchema.optional(),
  botao_arredondamento: z.enum(ARREDONDAMENTOS_BOTAO_AGENDAMENTO).optional(),
});
export type ConfigVisualAgendamento = z.infer<typeof configVisualSchema>;

// Valores padrão — reproduzem o visual que a página já tinha antes deste recurso (sem o que o
// admin nunca customizou, o formulário público não pode mudar de aparência).
export const CONFIG_VISUAL_PADRAO: Required<ConfigVisualAgendamento> = {
  cor_fundo: "#ffffff",
  cor_primaria: "#2563eb",
  cor_texto: "#111827",
  cor_texto_secundario: "#6b7280",
  fonte: "Inter",
  titulo_tamanho: "2xl",
  titulo_alinhamento: "center",
  subtitulo_tamanho: "lg",
  subtitulo_alinhamento: "center",
  botao_texto: "Confirmar agendamento",
  botao_cor: "#2563eb",
  botao_cor_texto: "#ffffff",
  botao_arredondamento: "md",
};

// Lê o jsonb do banco (pode ser {}, parcial ou lixo de uma versão antiga) e devolve sempre um
// ConfigVisualAgendamento completo — a página pública nunca quebra por um valor ausente/inválido.
export function resolverConfigVisual(bruto: unknown): Required<ConfigVisualAgendamento> {
  const parsed = configVisualSchema.safeParse(bruto && typeof bruto === "object" ? bruto : {});
  return { ...CONFIG_VISUAL_PADRAO, ...(parsed.success ? parsed.data : {}) };
}

export const TAMANHO_TITULO_CSS: Record<TamanhoTituloAgendamento, string> = {
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
};
export const TAMANHO_SUBTITULO_CSS: Record<TamanhoSubtituloAgendamento, string> = {
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
};
export const ARREDONDAMENTO_BOTAO_CSS: Record<ArredondamentoBotaoAgendamento, string> = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  full: "9999px",
};
// FONTE_AGENDAMENTO_CSS mora em src/lib/agendamentos/fontes.ts (precisa de next/font/google,
// não cabe neste módulo sem "server-only" que é importado por client components simples).

export const CAMPO_EXTRA_TIPOS = ["texto", "select"] as const;
export type CampoExtraTipo = (typeof CAMPO_EXTRA_TIPOS)[number];

export const campoExtraSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  tipo: z.enum(CAMPO_EXTRA_TIPOS),
  opcoes: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
});
export type CampoExtra = z.infer<typeof campoExtraSchema>;

export const agendamentoPaginaFormSchema = z
  .object({
    titulo: z
      .string({ error: "Informe o título." })
      .trim()
      .min(1, { error: "Informe o título." })
      .max(200, { error: "Máximo de 200 caracteres." }),
    slug: z
      .string({ error: "Informe o slug." })
      .trim()
      .min(1, { error: "Informe o slug." })
      .max(100)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
        error: "Use apenas letras minúsculas, números e hífens (ex: visita-marco).",
      }),
    descricao: z.string().trim().max(2000).optional(),
    cor_primaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." }),
    data_inicio: z.string().trim().optional(),
    data_fim: z.string().trim().optional(),
    vagas_por_horario: z.coerce
      .number({ error: "Informe um número." })
      .int()
      .positive({ error: "Precisa ser maior que zero." }),
    duracao_minutos: z.coerce
      .number({ error: "Informe um número." })
      .int()
      .positive({ error: "Precisa ser maior que zero." }),
    dias_antecedencia_minimo: z.coerce.number({ error: "Informe um número." }).int().nonnegative(),
    antecedencia_maxima_dias: z.coerce.number({ error: "Informe um número." }).int().positive({ error: "Precisa ser maior que zero." }),
    intervalo_entre_horarios: z.coerce.number({ error: "Informe um número." }).int().nonnegative(),
    mensagem_confirmacao: z.string().trim().max(1000).optional(),
    horarios_disponiveis: z.array(horarioDisponivelSchema).max(200).default([]),
    campos_extras: z.array(campoExtraSchema).max(20).default([]),
    local_atendimento: z.string().trim().max(300).optional(),
    responsavel_id: z.union([z.literal(""), z.uuid()]).optional(),
    feriados_bloqueados: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).default([]),
    datas_bloqueadas: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(200).default([]),
    // TAREFA — PARTE 3: campanha_paginas associada (opcional) — nunca confundir com
    // leads.campanha_id, que referencia campanhas_marketing (ver desvio na migration).
    campanha_id: z.union([z.literal(""), z.uuid()]).optional(),
    // TAREFA — PARTE 4: aparência do formulário público.
    config_visual: configVisualSchema.default({}),
  })
  .refine((data) => !data.data_fim || !data.data_inicio || data.data_fim >= data.data_inicio, {
    error: "A data de término deve ser igual ou posterior à data de início.",
    path: ["data_fim"],
  });

export type AgendamentoPaginaFormValues = z.infer<typeof agendamentoPaginaFormSchema>;

export type AgendamentoPagina = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  cor_primaria: string;
  logo_url: string | null;
  status: AgendamentoPaginaStatus;
  data_inicio: string | null;
  data_fim: string | null;
  vagas_por_horario: number;
  duracao_minutos: number;
  horarios_disponiveis: HorarioDisponivel[];
  dias_antecedencia_minimo: number;
  // Colunas novas (TAREFA agendamentos 2.4) — ausentes antes da migration 20261030500000.
  antecedencia_maxima_dias: number;
  intervalo_entre_horarios: number;
  local_atendimento: string | null;
  responsavel_id: string | null;
  feriados_bloqueados: string[];
  datas_bloqueadas: string[];
  campos_extras: CampoExtra[];
  mensagem_confirmacao: string | null;
  // Colunas novas (TAREFA) — ausentes antes das migrations 20261031400000/20261031500000.
  campanha_id: string | null;
  config_visual: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ResponsavelOpcao = { id: string; full_name: string | null };

// Converte "HH:MM" em minutos desde meia-noite, pra comparar janelas de horário.
function horarioParaMinutos(horario: string): number {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}

// Um horário fica bloqueado se cair dentro da janela [início, início + duração + intervalo) de
// QUALQUER outro horário já ocupado no mesmo dia — ex.: duração 30min + intervalo 15min, 14h
// ocupado => 14h15 e 14h30 também ficam bloqueados; o próximo horário livre é 14h45. Os horários
// candidatos continuam sendo só os configurados em horarios_disponiveis (não "qualquer minuto")
// — isto só decide quais DESSES ficam indisponíveis por estarem muito perto de um já ocupado.
// Sem "server-only" de propósito (diferente de agendamentos.ts): usada tanto no calendário do
// client (agendamento-publico-view.tsx) quanto na validação do servidor (actions.ts).
export function horarioBloqueadoPorIntervalo(
  horario: string,
  horariosOcupados: string[],
  duracaoMinutos: number,
  intervaloMinutos: number,
): boolean {
  if (intervaloMinutos <= 0) return false;
  const inicioCandidato = horarioParaMinutos(horario);
  return horariosOcupados.some((ocupado) => {
    const inicioOcupado = horarioParaMinutos(ocupado);
    const fimJanela = inicioOcupado + duracaoMinutos + intervaloMinutos;
    return inicioCandidato !== inicioOcupado && inicioCandidato >= inicioOcupado && inicioCandidato < fimJanela;
  });
}

export type Agendamento = {
  id: string;
  pagina_id: string;
  nome: string;
  whatsapp: string;
  data_agendada: string;
  horario: string;
  campos_extras: Record<string, string>;
  status: AgendamentoStatus;
  // Recado opcional do visitante (coluna nova; ausente antes da migration).
  mensagem?: string | null;
  // Preenchido só quando status === "cancelado" e o admin digitou um motivo (coluna nova; ver
  // 20261015100000_add_motivo_cancelamento_agendamento.sql — ausente antes dela).
  motivo_cancelamento?: string | null;
  // Colunas novas (TAREFA agendamentos 2.4, migration 20261030500000) — ausentes antes dela.
  email?: string | null;
  remarcado_de?: string | null;
  cancelado_por?: "admin" | "cliente" | null;
  // Já existia na tabela desde o início (ver agendar/[slug]/actions.ts), mas nunca tinha entrado
  // neste tipo — select("*") sempre trouxe a coluna, só faltava declarar.
  lead_id?: string | null;
  whatsapp_enviado: boolean;
  lembrete_enviado: boolean;
  created_at: string;
};

// Schema do formulário público (/agendar/[slug]) — "aceite_whatsapp" não tem
// coluna própria na migration (só as 6 colunas do INSERT abaixo existem em
// `agendamentos`), então é validado aqui como obrigatório mas nunca persiste.
export const agendamentoPublicoSchema = z.object({
  nome: z
    .string({ error: "Informe seu nome." })
    .trim()
    .min(1, { error: "Informe seu nome." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  whatsapp: z
    .string({ error: "Informe seu WhatsApp." })
    .trim()
    .min(8, { error: "Informe um WhatsApp válido." })
    .max(30)
    // DDD + celular: exatamente 11 dígitos (TelefoneInput, src/components/ui/telefone-input.tsx,
    // só produz esse formato — mesma regra do formulário, reforçada aqui pra quem submeter
    // direto por POST sem passar pela UI).
    .refine((valor) => valor.replace(/\D/g, "").length === 11, { error: "Informe um WhatsApp válido, com DDD e 9 dígitos." }),
  data_agendada: z.string({ error: "Selecione uma data." }).trim().min(1, { error: "Selecione uma data." }),
  horario: z.string({ error: "Selecione um horário." }).trim().min(1, { error: "Selecione um horário." }),
  campos_extras: z.record(z.string(), z.string()).optional(),
  // Opcional: só existe pra notificarEmailAgendamento (src/lib/email/eventos.ts) achar um e-mail
  // pra enviar a confirmação — o formulário não tem campo de e-mail fixo por padrão.
  email: z.union([z.literal(""), z.email({ error: "E-mail inválido." })]).optional(),
  mensagem: z.string().trim().max(500, { error: "A mensagem pode ter no máximo 500 caracteres." }).optional(),
  aceite_whatsapp: z.literal(true, { error: "É preciso concordar em receber mensagens pelo WhatsApp." }),
});
export type AgendamentoPublicoValues = z.infer<typeof agendamentoPublicoSchema>;
