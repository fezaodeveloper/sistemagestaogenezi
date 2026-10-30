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

export const EMPRESA_ASSINATURA_STATUSES = ["pendente", "ativa", "inativa", "cancelada"] as const;
export type EmpresaAssinaturaStatus = (typeof EMPRESA_ASSINATURA_STATUSES)[number];

export const EMPRESA_ASSINATURA_STATUS_LABELS: Record<EmpresaAssinaturaStatus, string> = {
  pendente: "Pendente",
  ativa: "Ativa",
  inativa: "Inativa",
  cancelada: "Cancelada",
};

// Cores pedidas na TAREFA: ativa=verde, pendente=amarelo, inativa/cancelada=vermelho.
export const EMPRESA_ASSINATURA_STATUS_BADGE_CLASS: Record<EmpresaAssinaturaStatus, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inativa: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  cancelada: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

// Preço da assinatura anual da empresa (TAREFA: empresa deixa de ser gratuita) — valor único,
// sem variação de plano como em PLANO_CONECTA_INFO (candidatos), por isso não entrou no mesmo
// Record por chave: só existe UM plano de empresa hoje.
export const VALOR_ASSINATURA_EMPRESA = 29.9;

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
  endereco: string | null;
  numero: string | null;
  link_maps: string | null;
  status: EmpresaStatus;
  aprovada_em: string | null;
  // Assinatura anual via Asaas (TAREFA) — mesmo modelo de perfis_conecta.asaas_subscription_id
  // (candidatos externos), aqui pra empresas. Requer a migration
  // 20261030100000_empresa_assinatura.sql (NÃO APLICADA ainda).
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  assinatura_status: EmpresaAssinaturaStatus;
  assinatura_vencimento: string | null;
  created_at: string;
  updated_at: string;
};

// Linha de empresa com os agregados usados só na listagem do admin — não
// vêm de empresas_conecta diretamente (total_vagas é contado à parte em
// vagas_conecta; ultimo_acesso vem da Admin API do Auth, já que
// auth.users.last_sign_in_at não é uma coluna de profiles/empresas_conecta).
// Razão social de MEI (Microempreendedor Individual) no Brasil segue o padrão oficial da
// Receita Federal "<8 primeiros dígitos do CNPJ> <NOME DO TITULAR>" (ex.: "60297147 CLEVERSSON
// DANTAS SALGUEIRO") — usado tanto no autofill do cadastro (consultarCnpj, src/app/empresa/
// cadastro/actions.ts) quanto aqui, na exibição, pra limpar empresas que já foram cadastradas
// com esse prefixo cru ANTES dessa limpeza existir (TAREFA: empresa aparecia com "Olá,
// 60.297.147 CLEVERSSON..." no painel).
export function limparNomeReceita(nome: string): string {
  return nome.replace(/^[\d.\-/\s]+/, "").trim() || nome;
}

// Nome de exibição da empresa ("Olá, {nome}") — nunca mostra o CNPJ/razão social completa: se
// nome_empresa estiver vazio, usa só a primeira palavra do email; se vier com o prefixo de CNPJ
// de MEI (cadastro antigo, antes da limpeza em consultarCnpj), remove esse prefixo na exibição.
export function nomeExibicaoEmpresa(empresa: { nome_empresa: string | null; email: string }): string {
  if (!empresa.nome_empresa?.trim()) return empresa.email.split("@")[0];
  return limparNomeReceita(empresa.nome_empresa);
}

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
export const VAGA_STATUS_LABELS: Record<VagaStatus, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};
export const VAGA_STATUS_BADGE_CLASS: Record<VagaStatus, string> = {
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  pausada: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  encerrada: "bg-muted text-muted-foreground",
};

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
  empresaSetor: string | null;
  empresaCidade: string | null;
  empresaEstado: string | null;
  empresaEndereco: string | null;
  empresaLinkMaps: string | null;
  empresaSite: string | null;
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
  plano: PlanoConecta | null;
  asaas_subscription_id: string | null;
  // Proteção de idade (candidatos externos preenchem no cadastro; alunos usam a própria
  // alunos.data_nascimento, não duplicada aqui — ver toggleVisibilidadePerfil).
  data_nascimento: string | null;
  menor_com_termo: boolean;
  termo_conecta_aceito: boolean;
  termo_conecta_data: string | null;
  created_at: string;
  updated_at: string;
  // Só populado pela listagem do admin (listarCandidatosExternos) — TAREFA: coluna
  // "Candidaturas" em /admin/conecta/candidatos.
  totalCandidaturas?: number;
  // Quebra por status das candidaturas acima — TAREFA: badge colorido por status no admin. Só as
  // chaves com pelo menos 1 candidatura aparecem aqui.
  candidaturasPorStatus?: Partial<Record<CandidaturaStatus, number>>;
};

export type CandidatosExternosFiltro = {
  query?: string;
  page?: number;
  limit?: number;
};

export type CandidatosExternosResultado = {
  candidatos: PerfilConecta[];
  total: number;
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

export type CandidatoConecta = {
  id: string;
  alunoId: string | null;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  resumo: string | null;
  experiencias: string | null;
  linkedinUrl: string | null;
  disponibilidade: Disponibilidade;
  modalidadePreferida: ModalidadePreferida;
  curriculoPath: string | null;
  cursosConcluidos: string[];
};

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
  // Obrigatório (TAREFA: empresa deixou de ser gratuita) — exigido pelo Asaas pra criar o
  // cliente/assinatura, mesmo motivo do cpf obrigatório em candidatoExternoCadastroSchema.
  cnpj: z
    .string({ error: "Informe o CNPJ." })
    .trim()
    .min(1, { error: "Informe o CNPJ." })
    .max(20),
  setor: z.enum(SETORES_CONECTA).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
  site: z.string().trim().max(300).optional(),
  endereco: z.string().trim().max(300).optional(),
  numero: z
    .string({ error: "Informe o número." })
    .trim()
    .min(1, { error: "Informe o número." })
    .max(20),
  link_maps: z.string().trim().max(500).optional(),
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

// Planos pagos do Gênezi Conecta para candidatos externos (não-alunos) —
// alunos ativos da GÊNEZI têm acesso gratuito (tipo 'aluno'), só externos
// (tipo 'externo') passam por assinatura recorrente via Asaas.
export const PLANOS_CONECTA = ["basico", "pro", "premium"] as const;
export type PlanoConecta = (typeof PLANOS_CONECTA)[number];

// Planos oferecidos a NOVOS cadastros (TAREFA: desativar PRO/PREMIUM) — PLANOS_CONECTA continua
// com os 3 valores porque assinantes já existentes com plano 'pro'/'premium' continuam
// aparecendo normalmente no admin (badge, cancelamento, etc.), só a oferta pra quem ainda não
// assinou é que fica restrita ao básico.
export const PLANOS_CONECTA_ATIVOS = ["basico"] as const satisfies readonly PlanoConecta[];

export const PLANO_CONECTA_INFO: Record<
  PlanoConecta,
  { label: string; valor: number; descricao: string; beneficio: string }
> = {
  // Ciclo passou de mensal pra anual (TAREFA: R$ 9,90/ano, era R$ 9,90/mês) — o valor numérico
  // não mudou, só o período de cobrança (cycle: "YEARLY" em criarAssinaturaConecta,
  // src/app/conecta/cadastro/actions.ts). "/mês" hardcoded na UI (vagas-publicas-view.tsx,
  // cadastro-externo-form.tsx) trocado por "/ano" separadamente.
  basico: {
    label: "Básico",
    valor: 9.9,
    descricao: "Acesso completo por 1 ano",
    beneficio: "Fique visível para empresas o ano todo",
  },
  pro: {
    label: "PRO",
    valor: 29.9,
    descricao: "Você se qualifica e fica visível",
    beneficio: "+ 1 curso online por ano",
  },
  premium: {
    label: "PREMIUM",
    valor: 39.9,
    descricao: "Você amplia suas qualificações e sua visibilidade profissional",
    beneficio: "+ 2 cursos online por ano",
  },
};

export const FORMAS_PAGAMENTO_CONECTA = ["PIX", "BOLETO", "CREDIT_CARD"] as const;
export type FormaPagamentoConecta = (typeof FORMAS_PAGAMENTO_CONECTA)[number];
export const FORMA_PAGAMENTO_CONECTA_LABELS: Record<FormaPagamentoConecta, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
};

export const candidatoExternoCadastroSchema = z.object({
  nome: z
    .string({ error: "Informe seu nome completo." })
    .trim()
    .min(1, { error: "Informe seu nome completo." })
    .max(200),
  email: z.email({ error: "Informe um e-mail válido." }),
  // Proteção de idade (ver TAREFA 1): menor de 16 é bloqueado, 16/17 exige o checkbox de
  // acompanhamento (validado fora deste schema, na action — depende da idade calculada).
  data_nascimento: z
    .string({ error: "Informe sua data de nascimento." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data de nascimento inválida." }),
  whatsapp: z
    .string({ error: "Informe seu WhatsApp." })
    .trim()
    .min(1, { error: "Informe seu WhatsApp." })
    .max(30),
  // Obrigatório: exigido pelo Asaas para criar o cliente/assinatura
  // (criarClienteAsaasConecta). Mínimo 11 dígitos porque o campo guarda a
  // máscara XXX.XXX.XXX-XX (11 dígitos + 3 pontuações).
  cpf: z
    .string({ error: "Informe o CPF." })
    .trim()
    .min(11, { error: "Informe o CPF." })
    .max(20),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
  // z.enum em PLANOS_CONECTA_ATIVOS (só 'basico'), não no PLANOS_CONECTA completo — garante que
  // um POST direto com plano=pro/premium também seja rejeitado pelo servidor, não só escondido
  // na UI (TAREFA: desativar PRO/PREMIUM pra novos cadastros).
  plano: z.enum(PLANOS_CONECTA_ATIVOS, { error: "Escolha um plano." }),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO_CONECTA, { error: "Escolha a forma de pagamento." }),
});
export type CandidatoExternoCadastroValues = z.infer<typeof candidatoExternoCadastroSchema>;

// ===== Admin — Etapa 5 (dashboard, vagas, candidatos) =====

export type KpisConecta = {
  empresasAtivas: number;
  vagasAtivas: number;
  candidatosVisiveis: number;
  assinantesAtivos: number;
};

export type AtividadeRecenteConecta = {
  empresasRecentes: { id: string; nome: string; createdAt: string }[];
  vagasRecentes: { id: string; titulo: string; empresaNome: string; createdAt: string }[];
  candidatosAtivadosRecentes: { id: string; nome: string; updatedAt: string }[];
};

export type VagaAdminConecta = {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string | null;
  cidade: string;
  estado: string;
  modalidade: VagaModalidade;
  tipo: VagaTipo;
  status: VagaStatus;
  salario_min: number | null;
  salario_max: number | null;
  salario_oculto: boolean;
  carga_horaria: string | null;
  created_at: string;
  empresaNome: string;
};

export type VagasAdminFiltro = {
  query?: string;
  status?: VagaStatus;
  tipo?: VagaTipo;
  modalidade?: VagaModalidade;
  page?: number;
  limit?: number;
};

export type VagasAdminResultado = { vagas: VagaAdminConecta[]; total: number };

export type AlunoVisivelConecta = {
  id: string;
  alunoId: string | null;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  disponibilidade: Disponibilidade;
  visivel: boolean;
  menorComTermo: boolean;
  cursosConcluidos: string[];
  totalCandidaturas: number;
  candidaturasPorStatus: Partial<Record<CandidaturaStatus, number>>;
};

export type AlunosVisiveisFiltro = { query?: string; page?: number; limit?: number };
export type AlunosVisiveisResultado = { alunos: AlunoVisivelConecta[]; total: number };

// ===== Cidades aprovadas (Etapa 7 — restringir cadastro de vaga a SE/AL,
// com espaço pra outros estados entrarem depois) =====
//
// SE/AL são os únicos dois estados conhecidos hoje pelo formulário de vaga
// da empresa e pelos filtros público/aluno (ambos ainda agrupam por esses
// dois fixos) — CIDADE_ESTADOS/LABELS/BADGE_CLASS abaixo continuam servindo
// esses agrupamentos. Mas o campo estado em si (na tabela e no formulário
// de "adicionar cidade" do admin) não é mais restrito a esses dois: a
// migration 20260917300000 relaxa o CHECK de conecta_cidades pra aceitar
// qualquer sigla de 2 letras, e cidadeConectaSchema abaixo valida esse
// formato (não um enum fechado) — se o admin cadastrar a primeira cidade de
// um estado novo (ex.: PE), ela aparece no filtro dinâmico da própria tela
// de cidades, mas ainda NÃO aparece agrupada no formulário de vaga da
// empresa nem nos filtros público/aluno, que exigiriam ficar dinâmicos
// também (fora do escopo desta tarefa).
export const CIDADE_ESTADOS = ["SE", "AL"] as const;
export type CidadeEstado = (typeof CIDADE_ESTADOS)[number];
export const CIDADE_ESTADO_LABELS: Record<CidadeEstado, string> = { SE: "Sergipe", AL: "Alagoas" };
export const CIDADE_ESTADO_BADGE_CLASS: Record<CidadeEstado, string> = {
  SE: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  AL: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
};

export type CidadeConecta = {
  id: string;
  nome: string;
  estado: string;
  ativa: boolean;
  ordem: number;
  created_at: string;
};

// Redesign da página pública /conecta/vagas — cards por cidade em vez de lista de vagas direta.
export type CidadeConectaComContagem = CidadeConecta & { totalVagas: number };

export const cidadeConectaSchema = z.object({
  nome: z
    .string({ error: "Informe o nome da cidade." })
    .trim()
    .min(1, { error: "Informe o nome da cidade." })
    .max(100),
  estado: z
    .string({ error: "Informe o estado." })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: "Use a sigla do estado (2 letras)." }),
});
export type CidadeConectaValues = z.infer<typeof cidadeConectaSchema>;

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

// ===== Candidatura interna (TAREFA: remover "Candidatar via WhatsApp" direto) =====

// 'contratado' (TAREFA: status de contratação) exige a migration
// 20261029300000_candidatura_status_contratado.sql aplicada (recria o CHECK constraint da
// coluna) — NÃO APLICADA ainda.
export const CANDIDATURA_STATUSES = ["pendente", "visualizado", "contato", "rejeitado", "contratado"] as const;
export type CandidaturaStatus = (typeof CANDIDATURA_STATUSES)[number];
export const CANDIDATURA_STATUS_LABELS: Record<CandidaturaStatus, string> = {
  pendente: "Pendente",
  visualizado: "Visualizado",
  contato: "Em contato",
  rejeitado: "Rejeitado",
  contratado: "Contratado",
};
// Cores pedidas na TAREFA: pendente=cinza, visualizado=azul, contato=amarelo,
// contratado=verde, rejeitado=vermelho.
export const CANDIDATURA_STATUS_BADGE_CLASS: Record<CandidaturaStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  visualizado: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  contato: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  rejeitado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  contratado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
};

// Candidatura do ponto de vista da EMPRESA — WhatsApp do candidato só é exposto aqui depois que
// a empresa abre os detalhes (ver marcarCandidaturaVisualizada), nunca na listagem.
export type CandidaturaEmpresa = {
  id: string;
  status: CandidaturaStatus;
  mensagem: string | null;
  createdAt: string;
  vagaId: string;
  vagaTitulo: string;
  candidatoNome: string;
  candidatoWhatsapp: string | null;
  candidatoResumo: string | null;
  candidatoCurriculoPath: string | null;
  candidatoCursosConcluidos: string[];
};

// Candidatura do ponto de vista do PRÓPRIO CANDIDATO (/aluno/conecta, seção "Minhas
// candidaturas") — sem WhatsApp/currículo/resumo, que não fazem sentido pro candidato ver sobre
// a própria candidatura; a cópia de status pro candidato é mais suave (ver
// MinhasCandidaturasConecta) do que CANDIDATURA_STATUS_LABELS, que é voltada à empresa/admin.
export type CandidaturaAluno = {
  id: string;
  status: CandidaturaStatus;
  vagaTitulo: string;
  nomeEmpresa: string;
  createdAt: string;
  updatedAt: string;
};
