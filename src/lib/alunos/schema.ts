import { z } from "zod";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
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

const commonAlunoFields = {
  full_name: z
    .string({ error: "Informe o nome completo." })
    .trim()
    .min(1, { error: "Informe o nome completo." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  cpf: cpfSchema,
  telefone: z
    .string({ error: "Informe o telefone." })
    .trim()
    .min(1, { error: "Informe o telefone." }),
  endereco: z.string().trim().max(500, { error: "Endereço muito longo." }).optional(),
  data_nascimento: z
    .string({ error: "Informe a data de nascimento." })
    .min(1, { error: "Informe a data de nascimento." })
    .refine((value) => new Date(`${value}T00:00:00`) <= new Date(), {
      error: "A data de nascimento não pode ser no futuro.",
    }),
  responsavel_nome: z.string().trim().optional(),
  responsavel_cpf: z.string().trim().optional(),
  responsavel_telefone: z.string().trim().optional(),
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

// Criação: inclui e-mail (usado só uma vez, pra criar a conta).
export const alunoFormSchema = z
  .object({ ...commonAlunoFields, email: z.email({ error: "Informe um e-mail válido." }) })
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
  created_at: string;
  updated_at: string;
};
