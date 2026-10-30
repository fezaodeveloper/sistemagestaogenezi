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

// Feriados nacionais fixos (data certa todo ano) + móveis (Carnaval/Sexta-feira Santa/Corpus
// Christi, calculados à mão pra 2025/2026 — não há biblioteca de feriados no projeto). Botão
// "Adicionar feriados nacionais 2025/2026" (TAREFA agendamentos 2.4, PARTE 2) só insere isto —
// não tenta calcular Páscoa dinamicamente nem cobre feriados estaduais/municipais.
export const FERIADOS_NACIONAIS_2025_2026: string[] = [
  "2025-01-01",
  "2025-03-03",
  "2025-03-04",
  "2025-04-18",
  "2025-04-21",
  "2025-05-01",
  "2025-06-19",
  "2025-09-07",
  "2025-10-12",
  "2025-11-02",
  "2025-11-15",
  "2025-11-20",
  "2025-12-25",
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-04-03",
  "2026-04-21",
  "2026-05-01",
  "2026-06-04",
  "2026-09-07",
  "2026-10-12",
  "2026-11-02",
  "2026-11-15",
  "2026-11-20",
  "2026-12-25",
];

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

export const horarioDisponivelSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  horario: z.string().regex(HORARIO_REGEX, { error: "Horário inválido (use HH:MM)." }),
});
export type HorarioDisponivel = z.infer<typeof horarioDisponivelSchema>;

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
  lembrete_2h_enviado?: boolean;
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
