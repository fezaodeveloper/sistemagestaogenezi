import { z } from "zod";

export const SETORES_CONECTA = [
  "Tecnologia",
  "Comércio",
  "Serviços",
  "Saúde",
  "Educação",
  "Indústria",
  "Construção",
  "Alimentação",
  "Outro",
] as const;
export type SetorConecta = (typeof SETORES_CONECTA)[number];

export const EMPRESA_STATUSES = ["pendente", "ativa", "suspensa", "cancelada"] as const;
export type EmpresaStatus = (typeof EMPRESA_STATUSES)[number];

export const EMPRESA_STATUS_LABELS: Record<EmpresaStatus, string> = {
  pendente: "Pendente",
  ativa: "Ativa",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

export const EMPRESA_STATUS_BADGE_CLASS: Record<EmpresaStatus, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  suspensa: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  cancelada: "bg-muted text-muted-foreground",
};

export type EmpresaConecta = {
  id: string;
  profile_id: string;
  nome_empresa: string;
  cnpj: string | null;
  nome_responsavel: string;
  email: string;
  whatsapp: string | null;
  telefone: string | null;
  site: string | null;
  setor: string | null;
  cidade: string | null;
  estado: string | null;
  logo_url: string | null;
  logo_path: string | null;
  descricao: string | null;
  status: EmpresaStatus;
  aprovada_em: string | null;
  created_at: string;
  updated_at: string;
};

// Linha de empresa com os agregados usados só na listagem do admin — não
// vêm de empresas_conecta diretamente (total_vagas é contado à parte em
// vagas_conecta; ultimo_acesso vem da Admin API do Auth, já que
// auth.users.last_sign_in_at não é uma coluna de profiles/empresas_conecta).
export type EmpresaConectaComExtras = EmpresaConecta & {
  totalVagas: number;
  ultimoAcesso: string | null;
};

export type EmpresasConectaFiltro = {
  query?: string;
  status?: EmpresaStatus;
  page?: number;
  limit?: number;
};

export type EmpresasConectaResultado = {
  empresas: EmpresaConectaComExtras[];
  total: number;
};

export const VAGA_MODALIDADES = ["presencial", "hibrido", "remoto"] as const;
export type VagaModalidade = (typeof VAGA_MODALIDADES)[number];
export const VAGA_MODALIDADE_LABELS: Record<VagaModalidade, string> = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  remoto: "Remoto",
};

export const VAGA_TIPOS = ["emprego", "estagio"] as const;
export type VagaTipo = (typeof VAGA_TIPOS)[number];
export const VAGA_TIPO_LABELS: Record<VagaTipo, string> = {
  emprego: "Emprego",
  estagio: "Estágio",
};

export const VAGA_STATUSES = ["ativa", "pausada", "encerrada"] as const;
export type VagaStatus = (typeof VAGA_STATUSES)[number];

export type VagaConecta = {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string;
  requisitos: string | null;
  cidade: string;
  estado: string;
  modalidade: VagaModalidade;
  tipo: VagaTipo;
  salario_min: number | null;
  salario_max: number | null;
  salario_oculto: boolean;
  carga_horaria: string | null;
  prazo_candidatura: string | null;
  status: VagaStatus;
  created_at: string;
  updated_at: string;
};

export type VagaConectaComEmpresa = VagaConecta & {
  empresaNome: string;
  empresaWhatsapp: string | null;
  empresaLogoUrl: string | null;
};

export type VagasConectaFiltro = {
  query?: string;
  tipo?: VagaTipo;
  modalidade?: VagaModalidade;
  cidade?: string;
  page?: number;
  limit?: number;
};

export type VagasConectaResultado = {
  vagas: VagaConectaComEmpresa[];
  total: number;
};

export const DISPONIBILIDADES = ["imediato", "15_dias", "30_dias", "a_combinar"] as const;
export type Disponibilidade = (typeof DISPONIBILIDADES)[number];
export const DISPONIBILIDADE_LABELS: Record<Disponibilidade, string> = {
  imediato: "Disponível imediatamente",
  "15_dias": "Em 15 dias",
  "30_dias": "Em 30 dias",
  a_combinar: "A combinar",
};

export const MODALIDADES_PREFERIDAS = ["presencial", "hibrido", "remoto", "qualquer"] as const;
export type ModalidadePreferida = (typeof MODALIDADES_PREFERIDAS)[number];
export const MODALIDADE_PREFERIDA_LABELS: Record<ModalidadePreferida, string> = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  remoto: "Remoto",
  qualquer: "Qualquer modalidade",
};

export type PerfilConecta = {
  id: string;
  aluno_id: string | null;
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  resumo: string | null;
  experiencias: string | null;
  linkedin_url: string | null;
  curriculo_url: string | null;
  curriculo_path: string | null;
  disponibilidade: Disponibilidade;
  modalidade_preferida: ModalidadePreferida;
  visivel: boolean;
  tipo: "aluno" | "externo";
  esta_ativo: boolean;
  created_at: string;
  updated_at: string;
};

// Campos de texto livre do perfil profissional do aluno — visivel (o toggle
// proeminente) e whatsapp-obrigatório-só-se-visível são tratados à parte
// (toggleVisibilidadePerfil), não fazem parte deste schema.
export const perfilConectaFormSchema = z.object({
  whatsapp: z.string().trim().max(30).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
  resumo: z.string().trim().max(500, { error: "Máximo de 500 caracteres." }).optional(),
  experiencias: z.string().trim().max(1000, { error: "Máximo de 1000 caracteres." }).optional(),
  linkedin_url: z.string().trim().max(300).optional(),
  disponibilidade: z.enum(DISPONIBILIDADES),
  modalidade_preferida: z.enum(MODALIDADES_PREFERIDAS),
});
export type PerfilConectaFormValues = z.infer<typeof perfilConectaFormSchema>;

export type NotificacaoEmpresa = {
  id: string;
  empresa_id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
};

// Etapa 1 (cadastro): só os campos preenchidos no formulário público — os
// demais (status, aprovada_em, ids) são resolvidos pela Server Action.
export const empresaCadastroSchema = z.object({
  nome_empresa: z
    .string({ error: "Informe o nome da empresa." })
    .trim()
    .min(1, { error: "Informe o nome da empresa." })
    .max(200),
  cnpj: z.string().trim().max(20).optional(),
  setor: z.enum(SETORES_CONECTA).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
  site: z.string().trim().max(300).optional(),
  nome_responsavel: z
    .string({ error: "Informe o nome do responsável." })
    .trim()
    .min(1, { error: "Informe o nome do responsável." })
    .max(200),
  email: z.email({ error: "Informe um e-mail válido." }),
  whatsapp: z
    .string({ error: "Informe o WhatsApp." })
    .trim()
    .min(1, { error: "Informe o WhatsApp." })
    .max(30),
  telefone: z.string().trim().max(30).optional(),
  senha: z
    .string({ error: "Informe uma senha." })
    .min(8, { error: "A senha precisa ter pelo menos 8 caracteres." }),
});
export type EmpresaCadastroValues = z.infer<typeof empresaCadastroSchema>;

export const vagaFormSchema = z.object({
  titulo: z
    .string({ error: "Informe o título da vaga." })
    .trim()
    .min(1, { error: "Informe o título da vaga." })
    .max(200),
  descricao: z
    .string({ error: "Informe a descrição da vaga." })
    .trim()
    .min(1, { error: "Informe a descrição da vaga." })
    .max(5000),
  requisitos: z.string().trim().max(5000).optional(),
  cidade: z
    .string({ error: "Informe a cidade." })
    .trim()
    .min(1, { error: "Informe a cidade." })
    .max(100),
  estado: z
    .string({ error: "Informe o estado." })
    .trim()
    .min(1, { error: "Informe o estado." })
    .max(2),
  modalidade: z.enum(VAGA_MODALIDADES),
  tipo: z.enum(VAGA_TIPOS),
  salario_min: z.coerce.number().min(0).optional(),
  salario_max: z.coerce.number().min(0).optional(),
  salario_oculto: z.boolean(),
  carga_horaria: z.string().trim().max(100).optional(),
  prazo_candidatura: z.string().trim().max(10).optional(),
});
export type VagaFormValues = z.infer<typeof vagaFormSchema>;
