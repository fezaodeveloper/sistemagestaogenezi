"use server";

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
    | "senha_temporaria"
    | "cpf"
    | "telefone"
    | "endereco"
    | "data_nascimento"
    | "cep"
    | "numero"
    | "complemento"
    | "bairro"
    | "cidade"
    | "estado"
    | "observacoes"
    | "status_aluno"
    | "responsavel_nome"
    | "responsavel_cpf"
    | "responsavel_telefone"
    | "responsavel_email"
    | "responsavel_complemento",
    string[]
  >
>;

type AlunoFormValuesEcho = {
  full_name: string;
  cpf: string;
  telefone: string;
  endereco: string;
  data_nascimento: string;
  cep: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacoes: string;
  status_aluno: string;
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_telefone: string;
  responsavel_email: string;
  responsavel_complemento: string;
};

type AlunoCreateValuesEcho = AlunoFormValuesEcho & { email: string; senha_temporaria: string };

export type AlunoFormState =
  | { errors?: AlunoFieldErrors; error?: string; values?: AlunoCreateValuesEcho }
  | undefined;

export type AlunoEditFormState =
  | { errors?: AlunoFieldErrors; error?: string; values?: AlunoFormValuesEcho }
  | undefined;

function echoValues(formData: FormData): AlunoCreateValuesEcho {
  return {
    email: String(formData.get("email") ?? ""),
    senha_temporaria: String(formData.get("senha_temporaria") ?? ""),
    ...echoEditValues(formData),
  };
}

function echoEditValues(formData: FormData): AlunoFormValuesEcho {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    cpf: String(formData.get("cpf") ?? ""),
    telefone: String(formData.get("telefone") ?? ""),
    endereco: String(formData.get("endereco") ?? ""),
    data_nascimento: String(formData.get("data_nascimento") ?? ""),
    cep: String(formData.get("cep") ?? ""),
    numero: String(formData.get("numero") ?? ""),
    complemento: String(formData.get("complemento") ?? ""),
    bairro: String(formData.get("bairro") ?? ""),
    cidade: String(formData.get("cidade") ?? ""),
    estado: String(formData.get("estado") ?? ""),
    observacoes: String(formData.get("observacoes") ?? ""),
    status_aluno: String(formData.get("status_aluno") ?? "ativo"),
    responsavel_nome: String(formData.get("responsavel_nome") ?? ""),
    responsavel_cpf: String(formData.get("responsavel_cpf") ?? ""),
    responsavel_telefone: String(formData.get("responsavel_telefone") ?? ""),
    responsavel_email: String(formData.get("responsavel_email") ?? ""),
    responsavel_complemento: String(formData.get("responsavel_complemento") ?? ""),
  };
}

// Campos opcionais do formulário: parse compartilhado entre create/update.
// FormData vazio vira "" (nunca null), então sem o `|| undefined` os campos
// optional() do Zod receberiam string vazia em vez de undefined — e um CEP
// "" cairia na validação de 8 dígitos em vez de ser tratado como "não
// informado".
function parseCommonFields(formData: FormData) {
  return {
    full_name: formData.get("full_name"),
    cpf: formData.get("cpf"),
    telefone: formData.get("telefone"),
    endereco: formData.get("endereco") || undefined,
    data_nascimento: formData.get("data_nascimento"),
    cep: formData.get("cep") || undefined,
    numero: formData.get("numero") || undefined,
    complemento: formData.get("complemento") || undefined,
    bairro: formData.get("bairro") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    status_aluno: formData.get("status_aluno") || undefined,
    responsavel_nome: formData.get("responsavel_nome") || undefined,
    responsavel_cpf: formData.get("responsavel_cpf") || undefined,
    responsavel_telefone: formData.get("responsavel_telefone") || undefined,
    responsavel_email: formData.get("responsavel_email") || undefined,
    responsavel_complemento: formData.get("responsavel_complemento") || undefined,
  };
}

export async function createAluno(
  _prevState: AlunoFormState,
  formData: FormData,
): Promise<AlunoFormState> {
  await requireRole("admin");

  const parsed = alunoFormSchema.safeParse({
    ...parseCommonFields(formData),
    email: formData.get("email"),
    senha_temporaria: formData.get("senha_temporaria"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: echoValues(formData),
    };
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // Senha gerada no cliente (crypto.getRandomValues) e mostrada só pro
  // admin copiar — nunca é exibida em outro lugar depois disso.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.senha_temporaria,
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
    return { error: message, values: echoValues(formData) };
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
    full_name: data.full_name,
    cep: data.cep ?? null,
    numero: data.numero ?? null,
    complemento: data.complemento ?? null,
    bairro: data.bairro ?? null,
    cidade: data.cidade ?? null,
    estado: data.estado ?? null,
    observacoes: data.observacoes ?? null,
    status_aluno: data.status_aluno,
    // user_id é redundante com o próprio id (ambos apontam pro mesmo usuário
    // Auth recém-criado) — a coluna existe pra permitir, futuramente, um
    // aluno cujo cadastro não tenha (ainda) uma conta vinculada.
    user_id: userId,
  });

  if (alunoError) {
    await admin.auth.admin.deleteUser(userId);
    const message =
      alunoError.code === "23505"
        ? "Já existe um aluno cadastrado com esse CPF."
        : "Não foi possível salvar os dados do aluno. Tente novamente.";
    return { error: message, values: echoValues(formData) };
  }

  if (isMinor(data.data_nascimento)) {
    const { error: responsavelError } = await supabase.from("responsaveis").insert({
      aluno_id: userId,
      nome: data.responsavel_nome!,
      cpf: data.responsavel_cpf!,
      telefone: data.responsavel_telefone!,
      email: data.responsavel_email ?? null,
      complemento: data.responsavel_complemento ?? null,
    });

    if (responsavelError) {
      await supabase.from("alunos").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return {
        error: "Não foi possível salvar os dados do responsável. Tente novamente.",
        values: echoValues(formData),
      };
    }
  }

  // Sem tela de sucesso separada: a senha já foi mostrada (e copiada) pelo
  // admin no próprio formulário, antes do envio — aqui só redireciona.
  revalidatePath("/admin/alunos");
  redirect("/admin/alunos?criado=1");
}

export async function updateAluno(
  id: string,
  _prevState: AlunoEditFormState,
  formData: FormData,
): Promise<AlunoEditFormState> {
  await requireRole("admin");

  const parsed = alunoEditFormSchema.safeParse(parseCommonFields(formData));

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
      full_name: data.full_name,
      cep: data.cep ?? null,
      numero: data.numero ?? null,
      complemento: data.complemento ?? null,
      bairro: data.bairro ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      observacoes: data.observacoes ?? null,
      status_aluno: data.status_aluno,
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
      email: data.responsavel_email ?? null,
      complemento: data.responsavel_complemento ?? null,
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

// ===== Foto do aluno (TAREFA 4B) =====
//
// Mesmo padrão da logo da escola / assinatura do diretor: o upload do
// arquivo acontece do lado do client, direto pro Supabase Storage (ver
// src/components/admin/foto-aluno-upload.tsx) — essa action só grava a
// URL/path já prontos na tabela.

export async function salvarFotoAluno(
  alunoId: string,
  fotoUrl: string,
  fotoPath: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  if (!fotoUrl || !fotoPath) {
    return { error: "Upload da foto falhou antes de salvar. Tente novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("alunos")
    .update({ foto_url: fotoUrl, foto_path: fotoPath })
    .eq("id", alunoId);

  if (error) {
    return { error: "Não foi possível salvar a foto. Tente novamente." };
  }

  revalidatePath("/admin/alunos");
  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}

export async function removerFotoAluno(alunoId: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();

  const { data: aluno } = await supabase
    .from("alunos")
    .select("foto_path")
    .eq("id", alunoId)
    .single();

  if (aluno?.foto_path) {
    const { error: storageError } = await supabase.storage.from("fotos-alunos").remove([aluno.foto_path]);
    if (storageError) {
      return { error: "Não foi possível remover o arquivo do Storage. Tente novamente." };
    }
  }

  const { error } = await supabase
    .from("alunos")
    .update({ foto_url: null, foto_path: null })
    .eq("id", alunoId);

  if (error) {
    return { error: "Arquivo removido do Storage, mas não foi possível atualizar o cadastro. Contate o suporte." };
  }

  revalidatePath("/admin/alunos");
  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}

export async function deleteAluno(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  // Apaga o usuário no Auth — profiles, alunos, matriculas e responsaveis já
  // têm "on delete cascade" encadeado a partir de auth.users, então tudo é
  // removido junto sem precisar de deletes separados.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    return { error: "Não foi possível excluir o aluno." };
  }

  revalidatePath("/admin/alunos");
  return {};
}
