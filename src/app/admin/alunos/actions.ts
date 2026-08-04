"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alunoFormSchema, alunoEditFormSchema, isMinor } from "@/lib/alunos/schema";

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

type AlunoFormValuesEcho = {
  full_name: string;
  email: string;
  cpf: string;
  telefone: string;
  endereco: string;
  data_nascimento: string;
  turma_id: string;
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_telefone: string;
};

export type AlunoFormState =
  | { errors?: AlunoFieldErrors; error?: string; values?: AlunoFormValuesEcho; success?: false }
  | { success: true; tempPassword: string; alunoId: string }
  | undefined;

export type AlunoEditFormState =
  | { errors?: AlunoFieldErrors; error?: string; values?: Omit<AlunoFormValuesEcho, "email"> }
  | undefined;

// "none" é o valor sentinela do <Select> pra "sem turma" — o Base UI Select
// não lida bem com item de value="". Convertido pra undefined aqui antes do Zod.
function readTurmaId(formData: FormData) {
  const raw = formData.get("turma_id");
  return raw && raw !== "none" ? raw : undefined;
}

function echoValues(formData: FormData): AlunoFormValuesEcho {
  return { email: String(formData.get("email") ?? ""), ...echoEditValues(formData) };
}

function echoEditValues(formData: FormData): Omit<AlunoFormValuesEcho, "email"> {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    cpf: String(formData.get("cpf") ?? ""),
    telefone: String(formData.get("telefone") ?? ""),
    endereco: String(formData.get("endereco") ?? ""),
    data_nascimento: String(formData.get("data_nascimento") ?? ""),
    turma_id: String(formData.get("turma_id") ?? "none"),
    responsavel_nome: String(formData.get("responsavel_nome") ?? ""),
    responsavel_cpf: String(formData.get("responsavel_cpf") ?? ""),
    responsavel_telefone: String(formData.get("responsavel_telefone") ?? ""),
  };
}

// 12 caracteres, alfanumérico + símbolos url-safe — uso único e descartável,
// repassada ao aluno fora do sistema (ex.: WhatsApp) pelo admin.
function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

export async function createAluno(
  _prevState: AlunoFormState,
  formData: FormData,
): Promise<AlunoFormState> {
  await requireRole("admin");

  const parsed = alunoFormSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    cpf: formData.get("cpf"),
    telefone: formData.get("telefone"),
    endereco: formData.get("endereco") || undefined,
    data_nascimento: formData.get("data_nascimento"),
    turma_id: readTurmaId(formData),
    responsavel_nome: formData.get("responsavel_nome") || undefined,
    responsavel_cpf: formData.get("responsavel_cpf") || undefined,
    responsavel_telefone: formData.get("responsavel_telefone") || undefined,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: echoValues(formData),
      success: false,
    };
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
    const message =
      createError?.code === "email_exists"
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta do aluno. Tente novamente.";
    return { error: message, values: echoValues(formData), success: false };
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
    const message =
      alunoError.code === "23505"
        ? "Já existe um aluno cadastrado com esse CPF."
        : "Não foi possível salvar os dados do aluno. Tente novamente.";
    return { error: message, values: echoValues(formData), success: false };
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
        values: echoValues(formData),
        success: false,
      };
    }
  }

  revalidatePath("/admin/alunos");
  return { success: true, tempPassword, alunoId: userId };
}

export async function updateAluno(
  id: string,
  _prevState: AlunoEditFormState,
  formData: FormData,
): Promise<AlunoEditFormState> {
  await requireRole("admin");

  const parsed = alunoEditFormSchema.safeParse({
    full_name: formData.get("full_name"),
    cpf: formData.get("cpf"),
    telefone: formData.get("telefone"),
    endereco: formData.get("endereco") || undefined,
    data_nascimento: formData.get("data_nascimento"),
    turma_id: readTurmaId(formData),
    responsavel_nome: formData.get("responsavel_nome") || undefined,
    responsavel_cpf: formData.get("responsavel_cpf") || undefined,
    responsavel_telefone: formData.get("responsavel_telefone") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoEditValues(formData) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const echoedValues = echoEditValues(formData);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: data.full_name })
    .eq("id", id);

  if (profileError) {
    return {
      error: "Não foi possível salvar o nome do aluno. Tente novamente.",
      values: echoedValues,
    };
  }

  const { error: alunoError } = await supabase
    .from("alunos")
    .update({
      cpf: data.cpf,
      telefone: data.telefone,
      endereco: data.endereco ?? null,
      data_nascimento: data.data_nascimento,
      turma_id: data.turma_id || null,
    })
    .eq("id", id);

  if (alunoError) {
    const message =
      alunoError.code === "23505"
        ? "Já existe um aluno cadastrado com esse CPF."
        : "Não foi possível salvar as alterações. Tente novamente.";
    return { error: message, values: echoedValues };
  }

  if (isMinor(data.data_nascimento)) {
    const { data: existing } = await supabase
      .from("responsaveis")
      .select("id")
      .eq("aluno_id", id)
      .maybeSingle();

    const responsavelPayload = {
      nome: data.responsavel_nome!,
      cpf: data.responsavel_cpf!,
      telefone: data.responsavel_telefone!,
    };

    const { error: responsavelError } = existing
      ? await supabase.from("responsaveis").update(responsavelPayload).eq("id", existing.id)
      : await supabase.from("responsaveis").insert({ aluno_id: id, ...responsavelPayload });

    if (responsavelError) {
      return {
        error: "Não foi possível salvar os dados do responsável. Tente novamente.",
        values: echoedValues,
      };
    }
  }

  revalidatePath("/admin/alunos");
  redirect("/admin/alunos");
}

export async function deleteAluno(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  // Apaga o usuário no Auth — profiles, alunos e responsaveis já têm
  // "on delete cascade" encadeado a partir de auth.users, então tudo é
  // removido junto sem precisar de deletes separados.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    return { error: "Não foi possível excluir o aluno." };
  }

  revalidatePath("/admin/alunos");
  return {};
}
