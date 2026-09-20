"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
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
  const usuario = await requireRole("admin");

  const parsed = z.email({ error: "Informe um e-mail válido." }).safeParse(novoEmail.trim().toLowerCase());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  const email = parsed.data;

  const admin = createAdminClient();
  const { data: aluno } = await admin.from("alunos").select("email").eq("id", alunoId).maybeSingle();
  if (!aluno) return { error: "Aluno não encontrado." };
  if (aluno.email.toLowerCase() === email) return { error: "Esse já é o e-mail atual do aluno." };

  const { error: authError } = await admin.auth.admin.updateUserById(alunoId, { email, email_confirm: true });
  if (authError) {
    return {
      error:
        authError.code === "email_exists"
          ? "Já existe uma conta com esse e-mail."
          : "Não foi possível alterar o e-mail. Tente novamente.",
    };
  }

  const { error: alunoError } = await admin.from("alunos").update({ email }).eq("id", alunoId);
  if (alunoError) {
    // Desfaz a troca no Auth pra não deixar login e cadastro divergentes.
    await admin.auth.admin.updateUserById(alunoId, { email: aluno.email, email_confirm: true });
    return { error: "Não foi possível alterar o e-mail. Tente novamente." };
  }

  await registrarAlteracao({
    tabela: "alunos",
    registroId: alunoId,
    campo: "email",
    valorAnterior: aluno.email,
    valorNovo: email,
    alteradoPor: usuario.id,
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

// Stub — a integração com a Evolution API (WhatsApp) virá depois; por ora só
// monta a mensagem e registra no log do servidor.
export async function enviarSenhaAlunoWhatsApp(
  alunoId: string,
  senha: string,
): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { data: aluno } = await admin.from("alunos").select("full_name, telefone, email").eq("id", alunoId).maybeSingle();
  if (!aluno) return { error: "Aluno não encontrado." };

  const mensagem = [
    `Olá, ${aluno.full_name}!`,
    "",
    "Seus dados de acesso à plataforma GÊNEZI:",
    `E-mail: ${aluno.email}`,
    `Senha: ${senha}`,
    "",
    "Por segurança, altere a senha no seu primeiro acesso.",
  ].join("\n");
  console.log(`[whatsapp:stub] Enviaria para ${aluno.telefone}:\n${mensagem}`);

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
