import { z } from "zod";

export const PREMIO_TIPOS = ["fisico", "digital", "hibrido"] as const;
export type PremioTipo = (typeof PREMIO_TIPOS)[number];

export const PREMIO_TIPO_LABELS: Record<PremioTipo, string> = {
  fisico: "🏠 Físico — entrega presencial pelo admin",
  digital: "💻 Digital — entrega automática por email/arquivo",
  hibrido: "🔄 Híbrido — combinação de entregas",
};

export const premioFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do prêmio." })
    .trim()
    .min(1, { error: "Informe o nome do prêmio." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  descricao: z
    .string()
    .trim()
    .max(2000, { error: "A descrição pode ter no máximo 2000 caracteres." })
    .optional(),
  custo_creditos: z.coerce
    .number({ error: "Informe o custo em créditos." })
    .int({ error: "O custo em créditos precisa ser um número inteiro." })
    .positive({ error: "O custo em créditos precisa ser maior que zero." }),
  estoque: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce
      .number()
      .int({ error: "O estoque precisa ser um número inteiro." })
      .min(0, { error: "O estoque não pode ser negativo." })
      .optional(),
  ),
  // Usado só pro alerta de estoque baixo (resumo diário + notificação
  // imediata ao editar) — não trava nada por conta própria, então não faz
  // sentido barrar o form se ficar em branco por engano; cai no padrão 5.
  estoque_minimo: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 5 : v),
    z.coerce
      .number()
      .int({ error: "O estoque mínimo precisa ser um número inteiro." })
      .min(0, { error: "O estoque mínimo não pode ser negativo." }),
  ),
  ativo: z.boolean(),
  tipo: z.enum(PREMIO_TIPOS).default("fisico"),
  // Entrega digital (TAREFA 11B) — só exibidos no form quando tipo é
  // 'digital'/'hibrido', mas ficam opcionais aqui mesmo assim (enviar em
  // branco pra um prêmio físico é inofensivo, não precisa de
  // .superRefine condicional). O arquivo de entrega em si (PDF/ZIP) não
  // entra neste schema — segue o mesmo padrão de "foto" (tratado à parte
  // na Server Action via validarArquivoDigital, não como campo Zod).
  entrega_email_conteudo: z
    .string()
    .trim()
    .max(5000, { error: "Conteúdo do email muito longo." })
    .optional(),
  entrega_whatsapp_mensagem: z
    .string()
    .trim()
    .max(2000, { error: "Mensagem muito longa." })
    .optional(),
});

export type PremioFormValues = z.infer<typeof premioFormSchema>;

export type Premio = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  custo_creditos: number;
  estoque: number | null;
  estoque_minimo: number | null;
  ativo: boolean;
  tipo: PremioTipo;
  entrega_email_conteudo: string | null;
  entrega_arquivo_url: string | null;
  entrega_arquivo_path: string | null;
  entrega_whatsapp_mensagem: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
