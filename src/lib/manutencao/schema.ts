import { z } from "zod";

export const MANUTENCAO_PRIORIDADES = ["baixa", "media", "alta", "urgente"] as const;
export type ManutencaoPrioridade = (typeof MANUTENCAO_PRIORIDADES)[number];

export const MANUTENCAO_PRIORIDADE_LABELS: Record<ManutencaoPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

// Mesmo padrão de cores fixas via className usado em PARCELA_STATUS_BADGE_CLASS
// (src/lib/financeiro/schema.ts) e afins — "urgente" usa vermelho sólido pra
// se destacar de "alta" (vermelho claro), já que os dois compartilhariam a
// mesma cor base.
export const MANUTENCAO_PRIORIDADE_BADGE_CLASS: Record<ManutencaoPrioridade, string> = {
  baixa: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  media: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  alta: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  urgente: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
};

export const MANUTENCAO_STATUSES = ["aberto", "em_andamento", "resolvido", "cancelado"] as const;
export type ManutencaoStatus = (typeof MANUTENCAO_STATUSES)[number];

export const MANUTENCAO_STATUS_LABELS: Record<ManutencaoStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

export const MANUTENCAO_STATUS_BADGE_CLASS: Record<ManutencaoStatus, string> = {
  aberto: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  em_andamento: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  resolvido: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  cancelado: "bg-muted text-muted-foreground",
};

// Chamados nesses status não contam como "pendência" ativa (ver Centro de
// Pendências, TAREFA 6) e só eles podem ser excluídos.
export const MANUTENCAO_STATUSES_ENCERRADOS: ManutencaoStatus[] = ["resolvido", "cancelado"];

export const manutencaoChamadoFormSchema = z.object({
  titulo: z
    .string({ error: "Informe o título." })
    .trim()
    .min(1, { error: "Informe o título." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  descricao: z.string().trim().max(2000, { error: "Máximo de 2000 caracteres." }).optional(),
  local: z.string().trim().max(200, { error: "Máximo de 200 caracteres." }).optional(),
  prioridade: z.enum(MANUTENCAO_PRIORIDADES, { error: "Selecione a prioridade." }),
});

export type ManutencaoChamadoFormValues = z.infer<typeof manutencaoChamadoFormSchema>;

export const manutencaoResolucaoFormSchema = z.object({
  observacoes_resolucao: z
    .string({ error: "Descreva como o chamado foi resolvido." })
    .trim()
    .min(1, { error: "Descreva como o chamado foi resolvido." })
    .max(2000, { error: "Máximo de 2000 caracteres." }),
});

export type ManutencaoResolucaoFormValues = z.infer<typeof manutencaoResolucaoFormSchema>;

export type ManutencaoChamado = {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  prioridade: ManutencaoPrioridade;
  status: ManutencaoStatus;
  resolvido_em: string | null;
  observacoes_resolucao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
