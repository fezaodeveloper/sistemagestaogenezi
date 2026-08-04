"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alunoFormSchema, isMinor } from "@/lib/alunos/schema";

type AlunoFieldErrors = Partial<
  Record<
    | "full_name"
    | "email"
    | "cpf"
    | "telefone"
    | "endereco"
    | "data_nascimento"
    | "turma_id"
    | "responsavel_nome"
    | "responsavel_cpf"
    | "responsavel_telefone",
    string[]
  >
>;

export type AlunoFormState =
  | { errors?: AlunoFieldErrors; error?: string; success?: false }
  | { success: true; tempPassword: string; alunoId: string }
  | undefined;

// 12 caracteres, alfanumérico + símbolos url-safe — uso único e descartável,
// repassada ao aluno fora do sistema (ex.: WhatsApp) pelo admin.
function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

function parseAlunoForm(formData: FormData) {
  return alunoFormSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    cpf: formData.get("cpf"),
    telefone: formData.get("telefone"),
    endereco: formData.get("endereco") || undefined,
    data_nascimento: formData.get("data_nascimento"),
    turma_id: formData.get("turma_id") || undefined,
    responsavel_nome: formData.get("responsavel_nome") || undefined,
    responsavel_cpf: formData.get("responsavel_cpf") || undefined,
    responsavel_telefone: formData.get("responsavel_telefone") || undefined,
  });
}

export async function createAluno(
  _prevState: AlunoFormState,
  formData: FormData,
): Promise<AlunoFormState> {
  await requireRole("admin");

  const parsed = parseAlunoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, success: false };
  }

  const data = parsed.data;
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      must_change_password: true,
    },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return { error: "Já existe uma conta com esse e-mail.", success: false };
    }
    return { error: "Não foi possível criar a conta do aluno. Tente novamente.", success: false };
  }

  const userId = created.user.id;
  const supabase = await createClient();

  const { error: alunoError } = await supabase.from("alunos").insert({
    id: userId,
    email: data.email,
    cpf: data.cpf,
    telefone: data.telefone,
    endereco: data.endereco ?? null,
    data_nascimento: data.data_nascimento,
    turma_id: data.turma_id || null,
  });

  if (alunoError) {
    await admin.auth.admin.deleteUser(userId);
    if (alunoError.code === "23505") {
      return { error: "Já existe um aluno cadastrado com esse CPF.", success: false };
    }
    return { error: "Não foi possível salvar os dados do aluno. Tente novamente.", success: false };
  }

  if (isMinor(data.data_nascimento)) {
    const { error: responsavelError } = await supabase.from("responsaveis").insert({
      aluno_id: userId,
      nome: data.responsavel_nome!,
      cpf: data.responsavel_cpf!,
      telefone: data.responsavel_telefone!,
    });

    if (responsavelError) {
      await supabase.from("alunos").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return {
        error: "Não foi possível salvar os dados do responsável. Tente novamente.",
        success: false,
      };
    }
  }

  revalidatePath("/admin/alunos");
  return { success: true, tempPassword, alunoId: userId };
}
