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

// "checkbox" é um GRUPO de opções marcáveis (várias ao mesmo tempo, valor salvo
// = array das letras marcadas). O antigo checkbox de um "Sim" único virou
// "checkbox_unico" (valor booleano) — ver 20260918700000_campanha_cards_destaque.sql,
// que renomeia o tipo nas questões já cadastradas.
export const QUESTAO_TIPOS = ["multipla_escolha", "texto", "checkbox", "checkbox_unico", "select"] as const;
export type QuestaoTipo = (typeof QUESTAO_TIPOS)[number];
export const QUESTAO_TIPO_LABELS: Record<QuestaoTipo, string> = {
  multipla_escolha: "Múltipla escolha",
  texto: "Texto livre",
  checkbox: "Checkbox (várias opções)",
  checkbox_unico: "Checkbox único (Sim)",
  select: "Select",
};

// Valor de uma resposta: texto/letra escolhida, boolean (checkbox único e
// consentimentos) ou array de letras (checkbox com várias opções).
export type RespostaValor = string | boolean | string[];

// Questão "checkbox" SEM opções é o checkbox único do modelo antigo (antes
// da migration renomear o tipo) — trata como checkbox_unico pra página
// continuar funcionando enquanto a migration não roda.
export function tipoQuestaoEfetivo(questao: { tipo: QuestaoTipo; opcoes?: unknown[] }): QuestaoTipo {
  if (questao.tipo === "checkbox" && (!questao.opcoes || questao.opcoes.length === 0)) return "checkbox_unico";
  return questao.tipo;
}

// Texto legível de uma resposta (tela de respostas e export em Excel).
export function formatarRespostaCampanha(valor: RespostaValor | undefined): string {
  if (valor === undefined || valor === null) return "—";
  if (Array.isArray(valor)) return valor.length > 0 ? valor.join(", ") : "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return valor === "" ? "—" : valor;
}

// ===== Etapa de confirmação (última etapa, opcional) =====
export const ETAPA_TIPOS = ["perguntas", "confirmacao"] as const;
export type EtapaTipo = (typeof ETAPA_TIPOS)[number];

export const CONFIRMACAO_TITULO_PADRAO = "Confirmação";
export const CONFIRMACAO_TEXTO_RESUMO_PADRAO = "Leia com atenção antes de enviar";
export const CONFIRMACAO_TEXTO_DECLARACAO_PADRAO = "Declaro ter interesse real nesta oportunidade.";
// Texto FIXO (não configurável) do consentimento — base legal: Lei Geral de
// Proteção de Dados (Lei nº 13.709/2018).
export const CONFIRMACAO_TEXTO_LGPD =
  "Autorizo o tratamento dos meus dados pessoais (nome, contato e respostas deste formulário) para fins de contato e processo de inscrição, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).";

export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type UfBrasil = (typeof UFS_BRASIL)[number];

// Chaves reservadas dentro de `respostas` (jsonb) pra consentimentos que não
// têm coluna própria — nunca colidem com id de questão real, que vem do
// editor como "q1", "q2" etc. (sempre sem "_" na frente).
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
  // "perguntas" (padrão, inclusive pra etapas antigas sem o campo) ou
  // "confirmacao": etapa final especial, sem perguntas, com resumo + dois
  // aceites obrigatórios (declaração de interesse e LGPD).
  tipo: z.enum(ETAPA_TIPOS).default("perguntas"),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).optional(),
  // Só na etapa de confirmação:
  texto_resumo: z.string().trim().max(500).optional(),
  texto_declaracao: z.string().trim().max(1000).optional(),
  questoes: z.array(questaoSchema).max(20).default([]),
});
export type Etapa = z.infer<typeof etapaSchema>;

// Cards de destaque do cabeçalho (ex.: "50%" / "DESCONTO") — no máximo 3.
export const cardDestaqueSchema = z.object({
  valor: z.string().trim().min(1, { error: "Informe o valor do card." }).max(20, { error: "Máximo de 20 caracteres." }),
  label: z.string().trim().min(1, { error: "Informe o rótulo do card." }).max(40, { error: "Máximo de 40 caracteres." }),
});
export type CardDestaque = z.infer<typeof cardDestaqueSchema>;
export const CARDS_DESTAQUE_MAXIMO = 3;

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
    cards_destaque: z.array(cardDestaqueSchema).max(CARDS_DESTAQUE_MAXIMO, { error: "No máximo 3 cards de destaque." }).default([]),
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
  })
  // No máximo uma etapa de confirmação, e sempre a última.
  .refine(
    (data) => {
      const indices = data.etapas.flatMap((etapa, i) => (etapa.tipo === "confirmacao" ? [i] : []));
      return indices.length === 0 || (indices.length === 1 && indices[0] === data.etapas.length - 1);
    },
    { error: "A etapa de confirmação deve ser única e ficar por último.", path: ["etapas"] },
  );

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
  cards_destaque: CardDestaque[];
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
  respostas: Record<string, RespostaValor>;
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
  respostas: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])).default({}),
});
export type CampanhaRespostaPublicaValues = z.infer<typeof campanhaRespostaPublicaSchema>;
