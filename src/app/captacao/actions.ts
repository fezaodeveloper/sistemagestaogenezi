"use server";

import { leadPublicoFormSchema } from "@/lib/leads/schema";
import { criarOuAtualizarLeadPublico } from "@/lib/leads/leads";

export type CaptacaoFormState =
  | {
      errors?: Partial<Record<"nome" | "telefone" | "curso_id" | "origem" | "observacoes", string[]>>;
      error?: string;
      success?: boolean;
    }
  | undefined;

// Única Server Action do projeto sem requireRole() — é intencional: esta
// página é pública, alcançável por qualquer visitante sem conta. A
// validação Zod abaixo é a única fronteira; a gravação em si roda via
// client admin dentro de criarOuAtualizarLeadPublico (ver lib/leads/leads.ts),
// já que não existe (nem deve existir) acesso de "anon" à tabela leads.
export async function criarLeadPublico(
  _prevState: CaptacaoFormState,
  formData: FormData,
): Promise<CaptacaoFormState> {
  const parsed = leadPublicoFormSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone"),
    curso_id: formData.get("curso_id"),
    origem: formData.get("origem"),
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const result = await criarOuAtualizarLeadPublico(parsed.data);
  if (result.error) {
    return { error: result.error };
  }

  return { success: true };
}
