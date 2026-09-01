import { z } from "zod";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

// Máscaras são só visuais (usadas nos formulários) — o schema abaixo sempre
// transforma pra dígitos antes de validar/salvar, então o valor que chega ao
// banco nunca tem pontuação, mesmo que o campo submetido venha mascarado.
export function formatCpf(value: string): string {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// Celular (DDD + 9 dígitos, 11 no total): (XX) XXXXX-XXXX.
// Fixo (DDD + 8 dígitos, 10 no total): (XX) XXXX-XXXX.
// Com DDI 55 na frente (12 ou 13 dígitos): remove o 55 e aplica o mesmo
// formato acima sobre o restante. Qualquer outra quantidade de dígitos
// (menos de 10, ou 12/13 sem prefixo 55 reconhecível, ou mais de 13) não é
// um telefone brasileiro válido reconhecido aqui — mostra os dígitos puros
// em vez de arriscar uma máscara errada.
export function formatTelefone(value: string): string {
  let digits = onlyDigits(value).slice(0, 13);

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }

  return digits;
}

export function formatCep(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

// "21/08/2026 às 14:32", sempre no fuso de exibição do sistema (o Genezi é
// uma escola brasileira — não há necessidade de detectar o fuso do
// navegador do admin).
export function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

export function calculateAge(dataNascimento: string): number {
  const birth = new Date(`${dataNascimento}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function isMinor(dataNascimento: string): boolean {
  return calculateAge(dataNascimento) < 18;
}

const cpfSchema = z
  .string({ error: "Informe o CPF." })
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 11, { error: "CPF deve ter 11 dígitos." });

const telefoneSchema = z
  .string({ error: "Informe o telefone." })
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 10 || value.length === 11, {
    error: "Telefone deve ter 10 ou 11 dígitos (com DDD).",
  });

// CEP também transforma pra dígitos antes de validar o tamanho — se
// validássemos o length no valor bruto (com máscara "00000-000", 9
// caracteres), o campo mascarado nunca passaria na validação.
const cepSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 8, { error: "CEP deve ter 8 dígitos." });

export const STATUS_ALUNO_VALUES = ["ativo", "inativo", "trancado", "formado"] as const;
export type StatusAluno = (typeof STATUS_ALUNO_VALUES)[number];
export const STATUS_ALUNO_LABELS: Record<StatusAluno, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  trancado: "Trancado",
  formado: "Formado",
};
// Cores fixas pedidas para a listagem (verde/amarelo/vermelho/azul) — os
// variants padrão do Badge (default/secondary/destructive/outline) não cobrem
// essa paleta, por isso sobrescrevemos bg/text diretamente via className.
export const STATUS_ALUNO_BADGE_CLASS: Record<StatusAluno, string> = {
  ativo: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inativo: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  trancado: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  formado: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
};

const commonAlunoFields = {
  full_name: z
    .string({ error: "Informe o nome completo." })
    .trim()
    .min(3, "Nome completo obrigatório")
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  cpf: cpfSchema,
  telefone: telefoneSchema,
  endereco: z.string().trim().max(500, { error: "Endereço muito longo." }).optional(),
  data_nascimento: z
    .string({ error: "Informe a data de nascimento." })
    .min(1, { error: "Informe a data de nascimento." })
    .refine((value) => new Date(`${value}T00:00:00`) <= new Date(), {
      error: "A data de nascimento não pode ser no futuro.",
    }),
  cep: cepSchema.optional(),
  numero: z.string().trim().max(20, { error: "Número muito longo." }).optional(),
  complemento: z.string().trim().max(200, { error: "Complemento muito longo." }).optional(),
  bairro: z.string().trim().max(200, { error: "Bairro muito longo." }).optional(),
  cidade: z.string().trim().max(200, { error: "Cidade muito longa." }).optional(),
  estado: z.string().trim().max(2, { error: "Use a sigla do estado (2 letras)." }).optional(),
  observacoes: z.string().trim().max(2000, { error: "Observações muito longas." }).optional(),
  status_aluno: z.enum(STATUS_ALUNO_VALUES).default("ativo"),
  responsavel_nome: z.string().trim().optional(),
  responsavel_cpf: z.string().trim().optional(),
  responsavel_telefone: z.string().trim().optional(),
  responsavel_email: z.email({ error: "E-mail do responsável inválido." }).optional(),
  responsavel_complemento: z.string().trim().optional(),
};

// Compartilhada entre criação e edição: campos do responsável só são
// obrigatórios quando a data de nascimento indica menor de idade. Duplicar a
// checagem em dois .superRefine() seria pior do que isolar só a função.
function validateResponsavelIfMinor(
  data: {
    data_nascimento: string;
    responsavel_nome?: string;
    responsavel_cpf?: string;
    responsavel_telefone?: string;
  },
  ctx: {
    addIssue: (issue: { code: "custom"; path: (string | number)[]; message: string }) => void;
  },
) {
  if (!isMinor(data.data_nascimento)) return;

  if (!data.responsavel_nome) {
    ctx.addIssue({
      code: "custom",
      path: ["responsavel_nome"],
      message: "Informe o nome do responsável (aluno menor de idade).",
    });
  }
  if (!data.responsavel_cpf || onlyDigits(data.responsavel_cpf).length !== 11) {
    ctx.addIssue({
      code: "custom",
      path: ["responsavel_cpf"],
      message: "Informe um CPF válido do responsável.",
    });
  }
  if (!data.responsavel_telefone) {
    ctx.addIssue({
      code: "custom",
      path: ["responsavel_telefone"],
      message: "Informe o telefone do responsável (aluno menor de idade).",
    });
  }
}

// Criação: inclui e-mail (usado só uma vez, pra criar a conta) e a senha
// temporária, gerada no cliente (crypto.getRandomValues) e só validada aqui
// quanto a presença/tamanho — a força da senha em si é garantida na geração.
export const alunoFormSchema = z
  .object({
    ...commonAlunoFields,
    email: z.email({ error: "Informe um e-mail válido." }),
    senha_temporaria: z
      .string({ error: "Gere uma senha temporária antes de cadastrar." })
      .min(8, { error: "Gere uma senha temporária antes de cadastrar." }),
  })
  .superRefine(validateResponsavelIfMinor);

// Edição: sem e-mail — mudar e-mail exige sincronizar com auth.users via
// Admin API, decisão separada pro futuro (ver migration).
export const alunoEditFormSchema = z
  .object(commonAlunoFields)
  .superRefine(validateResponsavelIfMinor);

export type AlunoFormValues = z.infer<typeof alunoFormSchema>;
export type AlunoEditFormValues = z.infer<typeof alunoEditFormSchema>;

export type Aluno = {
  id: string;
  email: string;
  cpf: string;
  telefone: string;
  endereco: string | null;
  data_nascimento: string;
  full_name: string | null;
  cep: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  status_aluno: StatusAluno;
  user_id: string | null;
  foto_url: string | null;
  foto_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AlunoWithRelations = Aluno & {
  profiles: { full_name: string | null } | null;
};

export type Responsavel = {
  id: string;
  aluno_id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  complemento: string | null;
  created_at: string;
  updated_at: string;
};
