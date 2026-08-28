import { z } from "zod";
import { onlyDigits } from "@/lib/alunos/schema";

// Mesma técnica de replace sucessivo de formatCpf/formatTelefone
// (src/lib/alunos/schema.ts) — só que pro formato 00.000.000/0000-00.
export function formatCnpj(value: string): string {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

const cnpjSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 14, { error: "CNPJ deve ter 14 dígitos." });

// Mesmo critério de cepSchema em src/lib/alunos/schema.ts (não exportado
// de lá, então reimplementado aqui pro domínio de configurações).
const cepSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 8, { error: "CEP deve ter 8 dígitos." });

export const escolaFormSchema = z.object({
  escola_nome: z
    .string({ error: "Informe o nome da escola." })
    .trim()
    .min(1, { error: "Informe o nome da escola." })
    .max(200, { error: "Nome muito longo." }),
  escola_cnpj: cnpjSchema.optional(),
  escola_telefone: z.string().trim().max(20, { error: "Telefone muito longo." }).optional(),
  escola_email: z.email({ error: "E-mail inválido." }).optional(),
  escola_site: z.string().trim().max(200, { error: "Site muito longo." }).optional(),
  escola_endereco: z.string().trim().max(300, { error: "Endereço muito longo." }).optional(),
  escola_cep: cepSchema.optional(),
  escola_cidade: z.string().trim().max(200, { error: "Cidade muito longa." }).optional(),
  escola_estado: z.string().trim().max(2, { error: "Use a sigla do estado (2 letras)." }).optional(),
});

export type EscolaFormValues = z.infer<typeof escolaFormSchema>;

export type ConfiguracoesEscola = {
  escola_nome: string | null;
  escola_cnpj: string | null;
  escola_telefone: string | null;
  escola_email: string | null;
  escola_endereco: string | null;
  escola_cidade: string | null;
  escola_estado: string | null;
  escola_cep: string | null;
  escola_site: string | null;
};

export type ConfiguracoesNotificacoes = {
  notif_financeiro_atrasado: boolean;
  notif_certificados_pendentes: boolean;
  notif_eventos_hoje: boolean;
  notif_eventos_amanha: boolean;
};
