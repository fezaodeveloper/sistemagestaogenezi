import { z } from "zod";

export const CAMPANHA_STATUSES = ["ativa", "inativa", "planejada"] as const;
export type CampanhaStatus = (typeof CAMPANHA_STATUSES)[number];

export const CAMPANHA_STATUS_LABELS: Record<CampanhaStatus, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  planejada: "Planejada",
};

// Verde/cinza/âmbar — mesmo padrão de cores fixas via className usado em
// FORNECEDOR_CATEGORIA_BADGE_CLASS (src/lib/fornecedores/schema.ts).
export const CAMPANHA_STATUS_BADGE_CLASS: Record<CampanhaStatus, string> = {
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inativa: "bg-muted text-muted-foreground",
  planejada: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

export const campanhaLinkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.url({ error: "Informe uma URL válida." }),
});
export type CampanhaLink = z.infer<typeof campanhaLinkSchema>;

export const campanhaFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome da campanha." })
    .trim()
    .min(1, { error: "Informe o nome da campanha." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  descricao: z.string().trim().max(2000, { error: "Máximo de 2000 caracteres." }).optional(),
  como_fazer: z.string().trim().max(5000, { error: "Máximo de 5000 caracteres." }).optional(),
  status: z.enum(CAMPANHA_STATUSES, { error: "Selecione o status." }),
  data_inicio: z.string().trim().optional(),
  data_fim: z.string().trim().optional(),
  orcamento_trafego: z.coerce.number().nonnegative({ error: "Informe um valor válido." }).optional(),
  orcamento_impressao: z.coerce.number().nonnegative({ error: "Informe um valor válido." }).optional(),
  links: z.array(campanhaLinkSchema).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  foto_url: z.string().trim().optional(),
  foto_path: z.string().trim().optional(),
});

export type CampanhaFormValues = z.infer<typeof campanhaFormSchema>;

export type CampanhaMarketing = {
  id: string;
  nome: string;
  descricao: string | null;
  como_fazer: string | null;
  status: CampanhaStatus;
  data_inicio: string | null;
  data_fim: string | null;
  orcamento_trafego: number | null;
  orcamento_impressao: number | null;
  links: CampanhaLink[];
  foto_url: string | null;
  foto_path: string | null;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
