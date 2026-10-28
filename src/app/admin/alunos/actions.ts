"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alunoFormSchema, alunoEditFormSchema, isMinor, onlyDigits, formatCpf } from "@/lib/alunos/schema";
import { registrarAlteracao } from "@/lib/historico/registrar";
import { dispararEvento } from "@/lib/automacoes/motor";
import { verificarBadgesProgressivos } from "@/lib/gamificacao/badges-progressivos";
import { ERRO_LOTE_INVALIDO, sanitizarIdsLote, type ResultadoExclusaoLote } from "@/lib/exclusao-em-lote";
import { dispararWebhook } from "@/lib/webhooks/disparar";
import { lerConfigSenhaPortal } from "@/lib/portal-login/config";
import { gerarHashSenha, gerarSenhaNumerica } from "@/lib/responsavel/senha";
import { enviarEmail } from "@/lib/email/provedor";
import { renderizarTemplate } from "@/lib/email/templates";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import { emSegundoPlano, notificarWhatsappAlunoSemAula } from "@/lib/whatsapp/eventos";

// ===== Portal do Responsável — mensagem com a senha (criação automática + botões do admin) =====
//
// Monta o mesmo texto tanto pro envio automático (aluno menor cadastrado/editado, em segundo
// plano) quanto pros botões explícitos no card do admin ("Gerar/Redefinir senha" e "Reenviar
// WhatsApp") — reenviar só pode significar "gerar de novo e enviar de novo", já que apenas o
// hash fica salvo (nunca o texto puro, ver src/lib/responsavel/senha.ts); não existe uma senha
// antiga pra buscar e reenviar.
function montarMensagemSenhaPortalResponsavel(nomeResponsavel: string, cpfResponsavel: string, senha: string): string {
  const linkPortal = `${process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app"}/responsavel`;
  return [
    `Olá, ${nomeResponsavel}!`,
    "",
    "Seus dados de acesso ao Portal do Responsável da GÊNEZI:",
    `CPF: ${formatCpf(cpfResponsavel)}`,
    `Senha: ${senha}`,
    "",
    `Acesse em: ${linkPortal}`,
  ].join("\n");
}

// Sem requireRole (chamado tanto de dentro de createAluno/updateAluno, já autenticados como
// admin, quanto da action exportada abaixo). Telefone ausente não é erro — só loga aviso e
// devolve enviado:false, pra quem chama decidir o que exibir (REGRAS da tarefa).
async function enviarMensagemSenhaPortalResponsavelInterno(params: {
  nome: string;
  telefone: string | null;
  cpf: string;
  senha: string;
}): Promise<{ ok: boolean; mensagem: string; enviado: boolean; erro?: string }> {
  const mensagem = montarMensagemSenhaPortalResponsavel(params.nome, params.cpf, params.senha);

  if (!params.telefone) {
    console.warn("[enviarSenhaPortalResponsavel] responsável sem telefone cadastrado — envio ignorado.");
    return { ok: true, mensagem, enviado: false };
  }

  const resultado = await enviarWhatsApp(params.telefone, mensagem);
  return { ok: resultado.ok, mensagem, enviado: resultado.enviado, erro: resultado.erro };
}

// Botões "Gerar/Redefinir senha" e "Reenviar WhatsApp" (RedefinirSenhaResponsavel) chamam esta
// action com a senha que acabaram de gerar (gerarNovaSenhaResponsavel) — devolve a MENSAGEM pra
// tela exibir junto da senha, além de se o envio de fato aconteceu.
export async function enviarSenhaPortalResponsavel(
  responsavelId: string,
  senha: string,
): Promise<{ success: true; mensagem: string; enviado: boolean } | { error: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { data: responsavel } = await admin
    .from("responsaveis")
    .select("nome, telefone, cpf")
    .eq("id", responsavelId)
    .maybeSingle();
  if (!responsavel) return { error: "Responsável não encontrado." };

  const resultado = await enviarMensagemSenhaPortalResponsavelInterno({
    nome: responsavel.nome,
    telefone: responsavel.telefone,
    cpf: responsavel.cpf,
    senha,
  });

  if (!resultado.ok) return { error: resultado.erro ?? "Falha ao enviar a mensagem." };
  return { success: true, mensagem: resultado.mensagem, enviado: resultado.enviado };
}

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

  // senha_portal: guardada em texto puro só pra poder reenviar por WhatsApp na confirmação de
  // matrícula (ver enviarMensagemMatriculaCriada em src/lib/mensagens/mensagens.ts) — o hash do
  // Supabase Auth nunca é legível de volta. NUNCA no modo "so_email": ali senhaInicial é um
  // token longo que ninguém deve conhecer/usar por design (ver comentário acima) — salvá-lo
  // aqui derrotaria esse modo. Best-effort: se a UPDATE falhar, o aluno já foi criado com
  // sucesso — a mensagem de matrícula só cai no fallback genérico (sem a senha).
  if (portal.tipo !== "so_email") {
    await supabase.from("alunos").update({ senha_portal: senhaInicial }).eq("id", userId);
  }

  if (isMinor(data.data_nascimento)) {
    // Senha do Portal do Responsável já sai gerada na criação (nunca fica sem senha_hash) — só
    // o hash vai pro banco, a senha em claro só existe aqui pra ser enviada por WhatsApp abaixo.
    const senhaResponsavel = gerarSenhaNumerica();
    const senhaHashResponsavel = await gerarHashSenha(senhaResponsavel);

    const { error: responsavelError } = await supabase.from("responsaveis").insert({
      aluno_id: userId,
      nome: data.responsavel_nome!,
      cpf: data.responsavel_cpf!,
      telefone: data.responsavel_telefone!,
      email: data.responsavel_email ?? null,
      complemento: data.responsavel_complemento ?? null,
      senha_hash: senhaHashResponsavel,
    });

    if (responsavelError) {
      await supabase.from("alunos").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return {
        error: "Não foi possível salvar os dados do responsável. Tente novamente.",
        values: echoValues(formData),
      };
    }

    // Em segundo plano (after()) — mesmo motivo de enviarSenhaAlunoWhatsApp: a Evolution API tem
    // delay anti-banimento de alguns segundos, não deve atrasar o redirect no fim desta action.
    const nomeResponsavel = data.responsavel_nome!;
    const telefoneResponsavel = data.responsavel_telefone!;
    const cpfResponsavel = data.responsavel_cpf!;
    emSegundoPlano(async () => {
      const resultado = await enviarMensagemSenhaPortalResponsavelInterno({
        nome: nomeResponsavel,
        telefone: telefoneResponsavel,
        cpf: cpfResponsavel,
        senha: senhaResponsavel,
      });
      if (!resultado.ok) {
        console.error("[createAluno] falha ao enviar senha do responsável por WhatsApp:", resultado.erro);
      }
    });
  }

  // Só matrícula disparava notificação no Telegram até aqui — cadastro de aluno (sem matrícula
  // ainda) ficava invisível pro admin. cpf mascarado (só os últimos 3 dígitos) já no payload,
  // por privacidade — o handler (notificarAlunoCadastrado) nunca recebe o CPF completo.
  const cpfDigitos = onlyDigits(data.cpf);
  const cpfMascarado = cpfDigitos.length >= 3 ? `***.***.***-${cpfDigitos.slice(-3)}` : "—";
  await dispararEvento(
    "aluno.cadastrado",
    { nome_aluno: data.full_name, email: data.email, cpf_mascarado: cpfMascarado, alunoId: userId },
    `aluno-cadastrado-${userId}`,
  );

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

    // Senha automática só quando o responsável está sendo criado agora por esta edição (não
    // existia antes) — uma linha já existente NUNCA tem senha_hash tocado aqui (nem pra gerar,
    // nem pra apagar), seja ela manual (gerarNovaSenhaResponsavel) ou automática.
    const senhaNova = existing ? null : gerarSenhaNumerica();
    const insertPayload = senhaNova
      ? { aluno_id: id, ...responsavelPayload, senha_hash: await gerarHashSenha(senhaNova) }
      : { aluno_id: id, ...responsavelPayload };

    const { error: responsavelError } = existing
      ? await supabase.from("responsaveis").update(responsavelPayload).eq("id", existing.id)
      : await supabase.from("responsaveis").insert(insertPayload);

    if (responsavelError) {
      return {
        error: "Não foi possível salvar os dados do responsável. Tente novamente.",
        values: echoedValues,
      };
    }

    if (senhaNova) {
      const nomeResponsavel = data.responsavel_nome!;
      const telefoneResponsavel = data.responsavel_telefone!;
      const cpfResponsavel = data.responsavel_cpf!;
      emSegundoPlano(async () => {
        const resultado = await enviarMensagemSenhaPortalResponsavelInterno({
          nome: nomeResponsavel,
          telefone: telefoneResponsavel,
          cpf: cpfResponsavel,
          senha: senhaNova,
        });
        if (!resultado.ok) {
          console.error("[updateAluno] falha ao enviar senha do responsável por WhatsApp:", resultado.erro);
        }
      });
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

  // Faltava revalidar a própria página de edição — só a lista era invalidada. Sem isso, o Router
  // Cache do Next podia continuar servindo a versão pré-edição de /admin/alunos/[id]/editar numa
  // navegação client-side de volta pra cá (ex.: clicar "Editar" de novo no aluno), mesmo o UPDATE
  // já tendo sido confirmado no banco (ver salvarFotoAluno/removerFotoAluno logo abaixo, que já
  // seguiam o padrão certo). Não existe uma página de "detalhes" separada de /editar neste app —
  // por isso só estas duas rotas.
  // 'layout' em /admin/alunos invalida também as rotas dinâmicas abaixo dela (ex.: a própria
  // /admin/alunos/[id]/editar) — o tipo default ('page') só invalidaria o path exato informado.
  revalidatePath("/admin/alunos", "layout");
  revalidatePath(`/admin/alunos/${id}/editar`, "page");
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

// ===== Portal do Responsável — senha (CPF + senha, ver Portal do Responsável) =====

// Mesma function serve pra gerar a PRIMEIRA senha (responsaveis.senha_hash ainda null) e pra
// redefinir uma já existente — não há distinção no backend, só no texto do botão/diálogo no
// client. Devolve a senha em texto claro UMA VEZ (nunca gravada em claro, ver senha.ts); como a
// tela de edição do aluno não faz redirect (diferente de createAluno), não há o problema de
// "senha que precisaria sobreviver a um redirect" — o admin vê e copia na mesma tela, sempre via
// este botão explícito (nunca gerada silenciosamente no cadastro).
export async function gerarNovaSenhaResponsavel(
  responsavelId: string,
): Promise<{ success: true; senha: string } | { error: string }> {
  await requireRole("admin");

  const senha = gerarSenhaNumerica();
  const senhaHash = await gerarHashSenha(senha);

  const supabase = await createClient();
  const { error } = await supabase.from("responsaveis").update({ senha_hash: senhaHash }).eq("id", responsavelId);
  if (error) {
    console.error("[gerarNovaSenhaResponsavel] erro Supabase:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível gerar a nova senha. Tente novamente." };
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

// ===== Portal do Responsável — enviar link por WhatsApp (botão na ficha do aluno) =====
//
// AWAITABLE (não emSegundoPlano/fire-and-forget) — diferente de enviarSenhaAlunoWhatsApp acima:
// o botão precisa mostrar sucesso/erro reais pro admin, não só "disparei e já volto". URL
// (/responsavel, sem id de aluno — o responsável entra só com o próprio CPF) usa o mesmo
// domínio-padrão de todo o projeto.
export async function enviarLinkPortalResponsavel(
  alunoId: string,
  telefoneResponsavel: string,
): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  if (!telefoneResponsavel) return { error: "Telefone do responsável não informado." };

  const admin = createAdminClient();
  const { data: aluno } = await admin.from("alunos").select("full_name").eq("id", alunoId).maybeSingle();
  if (!aluno) return { error: "Aluno não encontrado." };

  const linkPortal = `${process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app"}/responsavel`;
  const mensagem = [
    `Olá! Você é responsável por ${aluno.full_name ?? "um(a) aluno(a)"} na GÊNEZI.`,
    "",
    "Acesse o Portal do Responsável pra ver matrículas, contrato, termo de imagem e parcelas:",
    linkPortal,
    "",
    "Você vai precisar informar o CPF cadastrado como responsável pra entrar.",
  ].join("\n");

  const resultado = await enviarWhatsApp(telefoneResponsavel, mensagem);
  if (!resultado.ok) return { error: resultado.erro ?? "Falha ao enviar a mensagem." };
  if (!resultado.enviado) return { error: "WhatsApp (GênZap) não está ativo/conectado." };
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

export type EnviarMensagemSemAulaResult = { enviadas: number; erros: number };

// RPC alunos_sem_aula_ha_dias (supabase/migrations/20261015200000_rpc_alunos_sem_aula.sql) já
// filtra matrícula ativa + telefone preenchido — só itera e envia. Sequencial de propósito
// (for...of com await, não Promise.all): mesmo padrão dos crons de cobrança atrasada/follow-up
// de lead — cada chamada a notificarWhatsappAlunoSemAula já embute o delay anti-banimento.
export async function enviarMensagemSemAulaAction(): Promise<EnviarMensagemSemAulaResult> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("alunos_sem_aula_ha_dias", { dias: 7 });
  if (error || !data) {
    console.error("[enviarMensagemSemAulaAction]", error);
    return { enviadas: 0, erros: 0 };
  }

  let enviadas = 0;
  let erros = 0;
  for (const aluno of data as { aluno_id: string; telefone: string; nome: string }[]) {
    const resultado = await notificarWhatsappAlunoSemAula(aluno.telefone, aluno.nome);
    if (resultado.ok) enviadas++;
    else erros++;
  }

  return { enviadas, erros };
}
