"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { empresaCadastroSchema } from "@/lib/conecta/schema";

export type CadastroEmpresaState = { error?: string } | undefined;

// Fluxo análogo a createAluno (src/app/admin/alunos/actions.ts): cria o
// usuário já confirmado via client admin (sem etapa de verificação de
// e-mail — a empresa precisa poder acessar o painel na hora, mesmo que o
// cadastro em si fique "pendente" até um admin aprovar).
//
// Desvio do pedido original (que descrevia supabase.auth.signUp +
// UPDATE profiles direto): profiles.role só tem grant de update pra
// full_name/avatar_url no client autenticado (ver CLAUDE.md/
// 20260731180000_add_role_to_profiles.sql) — setar role exige o client
// admin (service_role), que já tem grant total em profiles desde
// 20260731150000_grant_service_role_profiles.sql. Por isso todo o
// provisionamento (createUser, UPDATE role, INSERT empresas_conecta) roda
// no client admin, e só o sign-in final (pra estabelecer a sessão do
// navegador) usa o client autenticado normal.
export async function cadastrarEmpresa(
  _prevState: CadastroEmpresaState,
  formData: FormData,
): Promise<CadastroEmpresaState> {
  const parsed = empresaCadastroSchema.safeParse({
    nome_empresa: formData.get("nome_empresa"),
    cnpj: formData.get("cnpj") || undefined,
    setor: formData.get("setor") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    site: formData.get("site") || undefined,
    nome_responsavel: formData.get("nome_responsavel"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp"),
    senha: formData.get("senha"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const confirmarSenha = formData.get("confirmar_senha");
  if (confirmarSenha !== parsed.data.senha) {
    return { error: "As senhas não coincidem." };
  }

  if (formData.get("aceite_termos") !== "on") {
    return { error: "É necessário concordar com os termos de uso." };
  }

  const data = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.senha,
    email_confirm: true,
    user_metadata: { full_name: data.nome_responsavel },
  });

  if (createError || !created.user) {
    const message =
      createError?.code === "email_exists"
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta. Tente novamente.";
    return { error: message };
  }

  const userId = created.user.id;

  const { error: roleError } = await admin.from("profiles").update({ role: "empresa" }).eq("id", userId);
  if (roleError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }

  const { data: empresa, error: empresaError } = await admin
    .from("empresas_conecta")
    .insert({
      profile_id: userId,
      nome_empresa: data.nome_empresa,
      cnpj: data.cnpj ?? null,
      nome_responsavel: data.nome_responsavel,
      email: data.email,
      whatsapp: data.whatsapp,
      site: data.site ?? null,
      setor: data.setor ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      status: "pendente",
    })
    .select("id")
    .single();

  if (empresaError || !empresa) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível salvar os dados da empresa. Tente novamente." };
  }

  // Best-effort — o cadastro já foi concluído com sucesso acima, uma falha
  // aqui (notificação) não deve impedir a empresa de acessar o painel.
  try {
    await dispararEvento(
      "empresa.cadastro",
      {
        nome_empresa: data.nome_empresa,
        nome_responsavel: data.nome_responsavel,
        whatsapp: data.whatsapp,
        cidade: data.cidade ?? "—",
        estado: data.estado ?? "—",
      },
      `empresa-cadastro-${empresa.id}`,
    );
  } catch {
    // Best-effort — ver comentário acima.
  }

  // Sign-in via client autenticado normal (não o admin) — é esse client que
  // grava os cookies de sessão na response, deixando a empresa já logada ao
  // chegar em /empresa/painel.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.senha,
  });

  if (signInError) {
    redirect("/empresa/login");
  }

  redirect("/empresa/painel?novo=true");
}
