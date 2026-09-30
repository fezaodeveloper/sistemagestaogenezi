"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alunoFormSchema, alunoEditFormSchema, isMinor } from "@/lib/alunos/schema";
import { registrarAlteracao } from "@/lib/historico/registrar";
import { dispararEvento } from "@/lib/automacoes/motor";
import { verificarBadgesProgressivos } from "@/lib/gamificacao/badges-progressivos";
import { ERRO_LOTE_INVALIDO, sanitizarIdsLote, type ResultadoExclusaoLote } from "@/lib/exclusao-em-lote";
import { dispararWebhook } from "@/lib/webhooks/disparar";
import { lerConfigSenhaPortal } from "@/lib/portal-login/config";
import { enviarEmail } from "@/lib/email/provedor";
import { renderizarTemplate } from "@/lib/email/templates";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import { emSegundoPlano } from "@/lib/whatsapp/eventos";

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

  // Tipo de senha do portal (Configurações > Portal do Aluno > Login):
  //  - padrao: senha gerada pelo admin no formulário — ou, se a escola definiu uma
  //    "senha padrão", ela vale pra todo aluno novo;
  //  - aleatoria: o servidor gera uma senha de 8 caracteres e a ENVIA por e-mail;
  //  - so_email: o aluno entra por link de acesso; a conta recebe uma senha aleatória
  //    longa que ninguém conhece.
  const portal = await lerConfigSenhaPortal();
  let senhaInicial = data.senha_temporaria;
  let enviarSenhaPorEmail = false;
  if (portal.tipo === "aleatoria") {
    senhaInicial = gerarSenhaAleatoria();
    enviarSenhaPorEmail = true;
  } else if (portal.tipo === "so_email") {
    senhaInicial = randomBytes(24).toString("base64url");
  } else if (portal.senhaPadrao) {
    senhaInicial = portal.senhaPadrao;
  }

  // Senha gerada no cliente (crypto.getRandomValues) e mostrada só pro
  // admin copiar — nunca é exibida em outro lugar depois disso.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: senhaInicial,
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

  // Modo "senha aleatória": o admin nunca vê a senha, então o e-mail com o acesso é o
  // único caminho. Enviado AQUI (não em segundo plano) pra a tela poder avisar se falhou.
  let acesso: "enviado" | "falhou" | null = null;
  if (enviarSenhaPorEmail) {
    acesso = "falhou";
    try {
      const renderizado = await renderizarTemplate("acesso", {
        nome_cliente: data.full_name,
        email_cliente: data.email,
        senha: senhaInicial,
        nome_produto: "Portal do Aluno",
        link_acesso: `${process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app"}/entrar`,
      });
      if (renderizado) {
        const r = await enviarEmail({ para: data.email, assunto: renderizado.assunto, html: renderizado.html, texto: renderizado.texto });
        if (r.ok) acesso = "enviado";
      }
    } catch {
      // acesso continua "falhou"
    }
  }

  // Sem tela de sucesso separada: a senha já foi mostrada (e copiada) pelo
  // admin no próprio formulário, antes do envio — aqui só redireciona.
  revalidatePath("/admin/alunos");
  redirect(acesso ? `/admin/alunos?criado=1&acesso=${acesso}` : "/admin/alunos?criado=1");
}

export async function updateAluno(
  id: string,
  _prevState: AlunoEditFormState,
  formData: FormData,
): Promise<AlunoEditFormState> {
  const user = await requireRole("admin");

  const parsed = alunoEditFormSchema.safeParse(parseCommonFields(formData));

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoEditValues(formData) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const echoedValues = echoEditValues(formData);

  // Snapshot pré-alteração (TAREFA 3) — precisa vir antes dos updates
  // abaixo, senão os valores "anteriores" já teriam sido sobrescritos.
  const { data: alunoAntes } = await supabase
    .from("alunos")
    .select("full_name, status_aluno, telefone, email, cpf")
    .eq("id", id)
    .maybeSingle();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: data.full_name })
    .eq("id", id);

  if (profileError) {
    console.error("[updateAluno] erro Supabase (profiles):", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });
    return {
      error: `Não foi possível salvar o nome do aluno: ${profileError.message} (${profileError.code})`,
      values: echoedValues,
    };
  }

  const dadosAluno = {
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
  };
  // Debug temporário — investigar "salva sem erro mas não persiste". id vai junto: se o filtro
  // .eq("id", id) estiver com o valor errado, o UPDATE não erra, só não afeta linha nenhuma (RLS
  // funciona do mesmo jeito: se a policy não bater pra aquela linha, ela é excluída do UPDATE em
  // silêncio, sem lançar 42501 — diferente de faltar GRANT na coluna, que aí sim erra).
  console.log("[updateAluno] payload:", JSON.stringify(dadosAluno), "| id:", id);

  // .select() é necessário pra saber quantas linhas o UPDATE realmente afetou — sem ele o
  // Supabase JS não devolve as linhas atualizadas (data viria sempre null, mesmo com sucesso).
  const { error: alunoError, data: alunoUpdateData } = await supabase
    .from("alunos")
    .update(dadosAluno)
    .eq("id", id)
    .select();

  console.log("[updateAluno] resultado:", {
    error: alunoError,
    data: alunoUpdateData,
    linhasAfetadas: alunoUpdateData?.length ?? 0,
  });

  if (alunoUpdateData && alunoUpdateData.length === 0 && !alunoError) {
    // UPDATE "teve sucesso" mas não tocou nenhuma linha — id errado ou RLS filtrando a linha em
    // silêncio (sem GRANT faltando isso daria 42501, não isso aqui). Reporta como erro de
    // verdade em vez de deixar a tela seguir como se tivesse salvo.
    console.error("[updateAluno] UPDATE afetou 0 linhas — id inexistente ou RLS bloqueando:", id);
    return {
      error: "Não foi possível salvar: nenhum registro foi alterado (verifique o ID do aluno ou permissões).",
      values: echoedValues,
    };
  }

  if (alunoError) {
    // Loga o erro completo do Supabase — a mensagem genérica que voltava pro admin escondia a
    // causa real (ex.: 42501 permission denied numa coluna sem grant de update).
    console.error("[updateAluno] erro Supabase (alunos):", {
      code: alunoError.code,
      message: alunoError.message,
      details: alunoError.details,
      hint: alunoError.hint,
    });
    const message =
      alunoError.code === "23505"
        ? "Já existe um aluno cadastrado com esse CPF."
        : `Não foi possível salvar as alterações: ${alunoError.message} (${alunoError.code})`;
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

  // Histórico de alterações (TAREFA 3) — best-effort, depois de tudo já
  // salvo com sucesso acima; registrarAlteracao só grava o que realmente
  // mudou (comparação feita ali dentro).
  if (alunoAntes) {
    await Promise.all([
      registrarAlteracao({
        tabela: "alunos",
        registroId: id,
        campo: "full_name",
        valorAnterior: alunoAntes.full_name,
        valorNovo: data.full_name,
        alteradoPor: user.id,
      }),
      registrarAlteracao({
        tabela: "alunos",
        registroId: id,
        campo: "status_aluno",
        valorAnterior: alunoAntes.status_aluno,
        valorNovo: data.status_aluno,
        alteradoPor: user.id,
      }),
      registrarAlteracao({
        tabela: "alunos",
        registroId: id,
        campo: "telefone",
        valorAnterior: alunoAntes.telefone,
        valorNovo: data.telefone,
        alteradoPor: user.id,
      }),
      registrarAlteracao({
        tabela: "alunos",
        registroId: id,
        campo: "email",
        valorAnterior: alunoAntes.email,
        valorNovo: alunoAntes.email,
        alteradoPor: user.id,
      }),
      registrarAlteracao({
        tabela: "alunos",
        registroId: id,
        campo: "cpf",
        valorAnterior: alunoAntes.cpf,
        valorNovo: data.cpf,
        alteradoPor: user.id,
      }),
    ]);
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

// ===== Redefinir senha (Melhoria 1) =====

export async function trocarSenhaAluno(
  alunoId: string,
  novaSenha: string,
): Promise<{ success?: true; error?: string }> {
  await requireRole("admin");

  if (novaSenha.length < 6) {
    return { error: "A nova senha precisa ter pelo menos 6 caracteres." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(alunoId, { password: novaSenha });

  if (error) {
    return { error: "Não foi possível redefinir a senha. Tente novamente." };
  }

  // Best-effort — a senha já foi trocada com sucesso acima, uma falha aqui
  // (busca do nome, notificação) não deve reportar erro pro admin.
  try {
    const supabase = await createClient();
    const { data: aluno } = await supabase
      .from("alunos")
      .select("full_name")
      .eq("id", alunoId)
      .maybeSingle();

    await dispararEvento(
      "senha.trocada.admin",
      { nome_aluno: aluno?.full_name ?? "—" },
      `senha-trocada-admin-${alunoId}-${Date.now()}`,
    );
  } catch {
    // Best-effort — ver comentário acima.
  }

  return { success: true };
}

// ===== Acesso à plataforma: trocar e-mail e gerar nova senha =====

// Sem caracteres ambíguos (0/O, 1/l/I) — a senha é lida pelo admin e ditada/
// enviada ao aluno.
const SENHA_LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const SENHA_DIGITOS = "23456789";

// 8 caracteres (letras + números), com pelo menos uma letra e um dígito.
// randomInt usa o CSPRNG do Node (não Math.random).
function gerarSenhaAleatoria(): string {
  const alfabeto = SENHA_LETRAS + SENHA_DIGITOS;
  for (;;) {
    let senha = "";
    for (let i = 0; i < 8; i++) senha += alfabeto[randomInt(alfabeto.length)];
    if (/[A-Za-z]/.test(senha) && /[0-9]/.test(senha)) return senha;
  }
}

// Troca o e-mail de login SEM e-mail de confirmação (client admin +
// email_confirm) — é o admin que garante o endereço. Mantém alunos.email em
// sincronia com auth.users.
export async function trocarEmailAluno(
  alunoId: string,
  novoEmail: string,
): Promise<{ success: true; email: string } | { error: string }> {
  // requireRole fica FORA do try/catch abaixo: ela usa redirect() quando o papel não bate, e
  // redirect() funciona lançando uma exceção especial que o Next intercepta rio acima — um
  // catch genérico ali dentro a engoliria e devolveria {error} em vez de redirecionar.
  const usuario = await requireRole("admin");

  try {
    return await trocarEmailAlunoInterno(alunoId, novoEmail, usuario.id);
  } catch (erro) {
    console.error("[trocarEmailAluno] exceção inesperada:", erro);
    return { error: `Erro inesperado: ${String(erro)}` };
  }
}

async function trocarEmailAlunoInterno(
  alunoId: string,
  novoEmail: string,
  usuarioId: string,
): Promise<{ success: true; email: string } | { error: string }> {
  const parsed = z.email({ error: "Informe um e-mail válido." }).safeParse(novoEmail.trim().toLowerCase());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  const email = parsed.data;

  const admin = createAdminClient();
  const { data: aluno } = await admin.from("alunos").select("email").eq("id", alunoId).maybeSingle();
  if (!aluno) return { error: "Aluno não encontrado." };
  if (aluno.email.toLowerCase() === email) return { error: "Esse já é o e-mail atual do aluno." };

  const { error: authError } = await admin.auth.admin.updateUserById(alunoId, { email, email_confirm: true });
  if (authError) {
    console.error("[trocarEmailAluno] erro do Supabase Auth:", {
      code: authError.code,
      message: authError.message,
      status: authError.status,
    });
    return {
      error:
        authError.code === "email_exists"
          ? "Já existe uma conta com esse e-mail."
          : `Não foi possível alterar o e-mail: ${authError.message}${authError.code ? ` (${authError.code})` : ""}`,
    };
  }

  const { error: alunoError } = await admin.from("alunos").update({ email }).eq("id", alunoId);
  if (alunoError) {
    console.error("[trocarEmailAluno] erro Supabase (alunos) — desfazendo troca no Auth:", {
      code: alunoError.code,
      message: alunoError.message,
      details: alunoError.details,
      hint: alunoError.hint,
    });
    // Desfaz a troca no Auth pra não deixar login e cadastro divergentes.
    await admin.auth.admin.updateUserById(alunoId, { email: aluno.email, email_confirm: true });
    return { error: `Não foi possível alterar o e-mail: ${alunoError.message} (${alunoError.code})` };
  }

  await registrarAlteracao({
    tabela: "alunos",
    registroId: alunoId,
    campo: "email",
    valorAnterior: aluno.email,
    valorNovo: email,
    alteradoPor: usuarioId,
  });

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return { success: true, email };
}

// Gera uma senha aleatória, aplica no Auth e DEVOLVE em texto pra o admin
// copiar — é a única vez que ela existe em claro (não é gravada em lugar nenhum).
export async function gerarNovaSenhaAluno(alunoId: string): Promise<{ success: true; senha: string } | { error: string }> {
  await requireRole("admin");

  const senha = gerarSenhaAleatoria();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(alunoId, { password: senha });
  if (error) return { error: "Não foi possível gerar a nova senha. Tente novamente." };

  try {
    const { data: aluno } = await admin.from("alunos").select("full_name").eq("id", alunoId).maybeSingle();
    await dispararEvento(
      "senha.trocada.admin",
      { nome_aluno: aluno?.full_name ?? "—" },
      `senha-trocada-admin-${alunoId}-${Date.now()}`,
    );
  } catch {
    // Best-effort — a senha já foi trocada.
  }

  return { success: true, senha };
}

// Envio real via GênZap (Evolution API) — antes era um stub que só logava a mensagem no
// console. Igual aos eventos automáticos deste projeto, dispara em segundo plano via after()
// (emSegundoPlano) em vez de esperar o resultado: enviarWhatsApp() tem um delay anti-banimento
// de alguns segundos (config do admin, 3-8s por padrão) somado ao tempo de rede até a Evolution
// API — esperar isso aqui reproduziria o mesmo bug de timeout já corrigido no botão "Enviar
// teste" de Configurações > WhatsApp. Por isso o retorno não confirma entrega, só que o envio
// foi agendado; falha real (WhatsApp desconectado, número inválido etc.) só aparece no log do
// servidor, nunca trava o clique do admin.
export async function enviarSenhaAlunoWhatsApp(
  alunoId: string,
  senha: string,
): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { data: aluno } = await admin.from("alunos").select("full_name, telefone, email").eq("id", alunoId).maybeSingle();
  if (!aluno) return { error: "Aluno não encontrado." };
  if (!aluno.telefone) return { error: "Este aluno não tem telefone cadastrado." };

  const linkAcesso = `${process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app"}/entrar`;
  const mensagem = [
    `Olá, ${aluno.full_name}!`,
    "",
    "Seus dados de acesso à plataforma GÊNEZI:",
    `E-mail: ${aluno.email}`,
    `Senha: ${senha}`,
    "",
    `Acesse em: ${linkAcesso}`,
    "",
    "Por segurança, altere a senha no seu primeiro acesso.",
  ].join("\n");

  const telefone = aluno.telefone;
  emSegundoPlano(async () => {
    const resultado = await enviarWhatsApp(telefone, mensagem);
    if (!resultado.ok) {
      console.error("[enviarSenhaAlunoWhatsApp] falha ao enviar:", resultado.erro);
    } else if (!resultado.enviado) {
      console.log("[enviarSenhaAlunoWhatsApp] WhatsApp desligado/desconectado — mensagem não enviada (stub silencioso).");
    }
  });

  // Webhook de saída. Nunca inclui a senha — só avisa que o acesso foi enviado.
  dispararWebhook("acesso_enviado", {
    aluno_id: alunoId,
    aluno_nome: aluno.full_name,
    aluno_email: aluno.email,
    aluno_telefone: aluno.telefone,
  });

  return { success: true };
}

// ===== Forçar verificação de conquistas (badges/recompensas pendentes) =====
//
// Usado quando um badge foi concedido via SQL (verificar_conquistas_aluno)
// sem passar pelo fluxo de recompensas TypeScript (concederRecompensasDeBadges
// só roda a partir de verificarBadgesProgressivos) — permite ao admin forçar a
// verificação e a entrega de recompensas pendentes pra um aluno específico,
// sem esperar o próximo login dele ou o cron diário.
export async function forcarVerificacaoBadgesAluno(alunoId: string): Promise<{ success: true }> {
  await requireRole("admin");

  await verificarBadgesProgressivos(alunoId);

  return { success: true };
}

// Exclusão em lote (seleção múltipla na listagem): mesma regra de deleteAluno —
// apaga o usuário no Auth e o cascade leva profile, aluno, matrículas (e o
// financeiro ligado a elas). Só ids que existem em `alunos` são tocados: o
// client admin apagaria qualquer usuário do Auth, inclusive um administrador,
// se recebesse o id dele por um POST forjado.
export async function deleteAlunosEmLote(ids: string[]): Promise<ResultadoExclusaoLote> {
  await requireRole("admin");

  const validos = sanitizarIdsLote(ids);
  if (!validos) return { excluidos: 0, falhas: [], erro: ERRO_LOTE_INVALIDO };

  const admin = createAdminClient();
  const { data: existentes } = await admin.from("alunos").select("id").in("id", validos);
  const idsAlunos = new Set((existentes ?? []).map((linha) => linha.id as string));

  let excluidos = 0;
  const falhas: string[] = [];
  // Em sequência (não em paralelo): cada delete dispara cascatas pesadas e a
  // Admin API do Auth tem limite de taxa.
  for (const id of validos) {
    if (!idsAlunos.has(id)) {
      falhas.push(id);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) falhas.push(id);
    else excluidos++;
  }

  revalidatePath("/admin/alunos");
  return { excluidos, falhas };
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
