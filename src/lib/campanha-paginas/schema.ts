import { z } from "zod";

export const CAMPANHA_PAGINA_STATUSES = ["ativa", "inativa", "encerrada"] as const;
export type CampanhaPaginaStatus = (typeof CAMPANHA_PAGINA_STATUSES)[number];

export const CAMPANHA_PAGINA_STATUS_LABELS: Record<CampanhaPaginaStatus, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  encerrada: "Encerrada",
};

export const CAMPANHA_PAGINA_STATUS_BADGE_CLASS: Record<CampanhaPaginaStatus, string> = {
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inativa: "bg-muted text-muted-foreground",
  encerrada: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export const CAMPANHA_TEMAS = ["escuro", "claro"] as const;
export type CampanhaTema = (typeof CAMPANHA_TEMAS)[number];

export const QUESTAO_TIPOS = ["multipla_escolha", "texto", "checkbox", "select"] as const;
export type QuestaoTipo = (typeof QUESTAO_TIPOS)[number];
export const QUESTAO_TIPO_LABELS: Record<QuestaoTipo, string> = {
  multipla_escolha: "Múltipla escolha",
  texto: "Texto livre",
  checkbox: "Checkbox",
  select: "Select",
};

// Chaves reservadas dentro de `respostas` (jsonb) pra consentimentos que não
// têm coluna própria — nunca colidem com id de questão real, que vem do
// editor como "q1", "q2" etc. (sempre sem "_" na frente).
export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type UfBrasil = (typeof UFS_BRASIL)[number];

export const RESPOSTA_CHAVE_LGPD = "_aceite_lgpd";
export const RESPOSTA_CHAVE_DECLARACAO = "_aceite_declaracao";

export const opcaoQuestaoSchema = z.object({
  letra: z.string().trim().min(1).max(5),
  texto: z.string().trim().min(1).max(200),
});
export type OpcaoQuestao = z.infer<typeof opcaoQuestaoSchema>;

export const questaoSchema = z.object({
  id: z.string().trim().min(1),
  tipo: z.enum(QUESTAO_TIPOS),
  pergunta: z.string().trim().min(1).max(500),
  obrigatoria: z.boolean(),
  // Sem limite de quantidade de opções (multipla_escolha, checkbox e select).
  opcoes: z.array(opcaoQuestaoSchema).optional(),
});
export type Questao = z.infer<typeof questaoSchema>;

export const etapaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).optional(),
  questoes: z.array(questaoSchema).max(20).default([]),
});
export type Etapa = z.infer<typeof etapaSchema>;

export const campanhaPaginaFormSchema = z
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
        error: "Use apenas letras minúsculas, números e hífens (ex: bolsa-marco).",
      }),
    subtitulo: z.string().trim().max(300).optional(),
    descricao: z.string().trim().max(2000).optional(),
    curso_id: z.uuid().optional(),
    cor_primaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." }),
    cor_fundo: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." }),
    cor_fonte: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." }),
    logo_url: z.string().trim().optional(),
    imagem_topo_url: z.string().trim().optional(),
    tema: z.enum(CAMPANHA_TEMAS),
    status: z.enum(CAMPANHA_PAGINA_STATUSES),
    data_inicio: z.string().trim().optional(),
    data_fim: z.string().trim().optional(),
    vagas_limite: z.coerce.number().int().positive().optional(),
    mostrar_contador: z.boolean(),
    contador_data_fim: z.string().trim().optional(),
    coletar_email: z.boolean(),
    coletar_cidade: z.boolean(),
    etapas: z.array(etapaSchema).max(20).default([]),
    mostrar_lgpd: z.boolean(),
    texto_lgpd: z.string().trim().max(3000).optional(),
    mostrar_declaracao: z.boolean(),
    texto_declaracao: z.string().trim().max(3000).optional(),
    titulo_sucesso: z
      .string({ error: "Informe o título da tela de sucesso." })
      .trim()
      .min(1, { error: "Informe o título da tela de sucesso." })
      .max(200),
    mensagem_sucesso: z.string().trim().max(1000).optional(),
    notificar_telegram: z.boolean(),
  })
  .refine((data) => !data.data_fim || !data.data_inicio || data.data_fim >= data.data_inicio, {
    error: "A data de término deve ser igual ou posterior à data de início.",
    path: ["data_fim"],
  });

export type CampanhaPaginaFormValues = z.infer<typeof campanhaPaginaFormSchema>;

export type CampanhaPagina = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  curso_id: string | null;
  cor_primaria: string;
  cor_fundo: string;
  cor_fonte: string;
  logo_url: string | null;
  imagem_topo_url: string | null;
  tema: CampanhaTema;
  status: CampanhaPaginaStatus;
  data_inicio: string | null;
  data_fim: string | null;
  vagas_limite: number | null;
  mostrar_contador: boolean;
  contador_data_fim: string | null;
  coletar_email: boolean;
  coletar_cidade: boolean;
  etapas: Etapa[];
  mostrar_lgpd: boolean;
  texto_lgpd: string | null;
  mostrar_declaracao: boolean;
  texto_declaracao: string | null;
  titulo_sucesso: string;
  mensagem_sucesso: string | null;
  notificar_telegram: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CampanhaResposta = {
  id: string;
  pagina_id: string;
  nome: string;
  whatsapp: string;
  idade: number | null;
  email: string | null;
  estado: string | null;
  cidade: string | null;
  respostas: Record<string, string | boolean>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

// Schema do formulário público (/campanha/[slug]).
export const campanhaRespostaPublicaSchema = z.object({
  nome: z
    .string({ error: "Informe seu nome." })
    .trim()
    .min(1, { error: "Informe seu nome." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  whatsapp: z
    .string({ error: "Informe seu WhatsApp." })
    .trim()
    .min(8, { error: "Informe um WhatsApp válido." })
    .max(30),
  idade: z.coerce.number({ error: "Informe sua idade." }).int().positive().max(120),
  email: z.string().trim().max(200).optional(),
  estado: z.enum(UFS_BRASIL, { error: "Selecione um estado válido." }).optional(),
  cidade: z.string().trim().max(200).optional(),
  respostas: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
});
export type CampanhaRespostaPublicaValues = z.infer<typeof campanhaRespostaPublicaSchema>;
