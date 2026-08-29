"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { escolaFormSchema } from "@/lib/configuracoes/schema";
import { CERTIFICADO_STATUS_LABELS } from "@/lib/certificados/certificados";
import { PARCELA_STATUS_LABELS } from "@/lib/financeiro/schema";
import { PRESENCA_STATUS_LABELS, type PRESENCA_STATUSES } from "@/lib/presencas/schema";
import { BANNER_BUCKET } from "@/lib/storage/banners";
import {
  bannerLoginUpdateSchema,
  LOGIN_BANNER_TIPOS,
  type LoginBanner,
  type LoginBannerTamanho,
  type LoginBannerTipo,
} from "@/lib/login-banners/schema";

export async function updateEadGamificacao(ativo: boolean): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({ ead_participa_gamificacao: ativo, updated_by: user.id })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export async function updateCriteriosCertificado(
  notaMinima: number,
  frequenciaMinima: number,
): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  if (
    !Number.isInteger(notaMinima) ||
    notaMinima < 0 ||
    notaMinima > 100 ||
    !Number.isInteger(frequenciaMinima) ||
    frequenciaMinima < 0 ||
    frequenciaMinima > 100
  ) {
    return { error: "Os percentuais precisam ser números inteiros entre 0 e 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      certificado_nota_minima_percentual: notaMinima,
      certificado_frequencia_minima_percentual: frequenciaMinima,
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export type EscolaFormValuesEcho = {
  escola_nome: string;
  escola_cnpj: string;
  escola_telefone: string;
  escola_email: string;
  escola_site: string;
  escola_endereco: string;
  escola_cep: string;
  escola_cidade: string;
  escola_estado: string;
};

export type EscolaFormState =
  | {
      errors?: Partial<Record<keyof EscolaFormValuesEcho, string[]>>;
      error?: string;
      values?: EscolaFormValuesEcho;
      salvo?: boolean;
    }
  | undefined;

function echoEscolaValues(formData: FormData): EscolaFormValuesEcho {
  return {
    escola_nome: String(formData.get("escola_nome") ?? ""),
    escola_cnpj: String(formData.get("escola_cnpj") ?? ""),
    escola_telefone: String(formData.get("escola_telefone") ?? ""),
    escola_email: String(formData.get("escola_email") ?? ""),
    escola_site: String(formData.get("escola_site") ?? ""),
    escola_endereco: String(formData.get("escola_endereco") ?? ""),
    escola_cep: String(formData.get("escola_cep") ?? ""),
    escola_cidade: String(formData.get("escola_cidade") ?? ""),
    escola_estado: String(formData.get("escola_estado") ?? ""),
  };
}

export async function salvarDadosEscola(
  _prevState: EscolaFormState,
  formData: FormData,
): Promise<EscolaFormState> {
  const user = await requireRole("admin");

  const parsed = escolaFormSchema.safeParse({
    escola_nome: formData.get("escola_nome"),
    escola_cnpj: formData.get("escola_cnpj") || undefined,
    escola_telefone: formData.get("escola_telefone") || undefined,
    escola_email: formData.get("escola_email") || undefined,
    escola_site: formData.get("escola_site") || undefined,
    escola_endereco: formData.get("escola_endereco") || undefined,
    escola_cep: formData.get("escola_cep") || undefined,
    escola_cidade: formData.get("escola_cidade") || undefined,
    escola_estado: formData.get("escola_estado") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoEscolaValues(formData) };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      escola_nome: data.escola_nome,
      escola_cnpj: data.escola_cnpj ?? null,
      escola_telefone: data.escola_telefone ?? null,
      escola_email: data.escola_email ?? null,
      escola_site: data.escola_site ?? null,
      escola_endereco: data.escola_endereco ?? null,
      escola_cep: data.escola_cep ?? null,
      escola_cidade: data.escola_cidade ?? null,
      escola_estado: data.escola_estado ?? null,
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    return {
      error: "Não foi possível salvar os dados da escola. Tente novamente.",
      values: echoEscolaValues(formData),
    };
  }

  revalidatePath("/admin/configuracoes");
  return { values: echoEscolaValues(formData), salvo: true };
}

export type NotificacoesFormState = { error?: string; salvo?: boolean } | undefined;

export async function salvarNotificacoes(
  _prevState: NotificacoesFormState,
  formData: FormData,
): Promise<NotificacoesFormState> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      notif_financeiro_atrasado: formData.get("notif_financeiro_atrasado") === "on",
      notif_certificados_pendentes: formData.get("notif_certificados_pendentes") === "on",
      notif_eventos_hoje: formData.get("notif_eventos_hoje") === "on",
      notif_eventos_amanha: formData.get("notif_eventos_amanha") === "on",
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar as preferências. Tente novamente." };
  }

  // Revalida também o layout do admin — é lá que o sino de notificações
  // (src/components/admin/sino-notificacoes.tsx) lê essas preferências.
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin");
  return { salvo: true };
}

export type BackupDados = {
  geradoEm: string;
  alunos: unknown[];
  matriculas: unknown[];
  turmas: unknown[];
  cursos: unknown[];
  parcelas: unknown[];
  gastos: unknown[];
};

export type GerarBackupResult = { success: true; data: BackupDados } | { error: string };

// Só tabelas de negócio — nada de auth.users/sessões. O client aqui é o de
// usuário normal (RLS de admin), não o service_role: nenhuma dessas
// tabelas guarda segredo de autenticação, então não há necessidade do
// bypass do client admin só pra ler.
export async function gerarBackup(): Promise<GerarBackupResult> {
  await requireRole("admin");

  const supabase = await createClient();

  const [
    { data: alunos, error: erroAlunos },
    { data: matriculas, error: erroMatriculas },
    { data: turmas, error: erroTurmas },
    { data: cursos, error: erroCursos },
    { data: parcelas, error: erroParcelas },
    { data: gastos, error: erroGastos },
  ] = await Promise.all([
    supabase.from("alunos").select("id, full_name, email, cpf, telefone, status_aluno, created_at"),
    supabase
      .from("matriculas")
      .select("id, aluno_id, turma_id, status, valor_final, num_parcelas, forma_pagamento, data_matricula"),
    supabase.from("turmas").select("id, nome, curso_id, status, data_inicio, data_fim"),
    supabase.from("cursos").select("id, nome, tipo, status, valor"),
    supabase
      .from("parcelas")
      .select("id, matricula_id, aluno_id, numero_parcela, valor, data_vencimento, data_pagamento, status"),
    supabase.from("gastos").select("id, descricao, categoria, valor, data_gasto"),
  ]);

  if (erroAlunos || erroMatriculas || erroTurmas || erroCursos || erroParcelas || erroGastos) {
    return { error: "Não foi possível gerar o backup. Tente novamente." };
  }

  return {
    success: true,
    data: {
      geradoEm: new Date().toISOString(),
      alunos: alunos ?? [],
      matriculas: matriculas ?? [],
      turmas: turmas ?? [],
      cursos: cursos ?? [],
      parcelas: parcelas ?? [],
      gastos: gastos ?? [],
    },
  };
}

export type LogSistemaEntrada = {
  id: string;
  dataHora: string;
  tipo: "webhook_asaas" | "presenca" | "parcela" | "certificado";
  descricao: string;
  usuario: string;
};

// Simplificado: junta as últimas linhas de 4 tabelas que já registram
// data/hora (log_webhooks_asaas, presencas, parcelas, certificados) e
// mostra as 50 mais recentes juntas — não existe uma tabela de auditoria
// dedicada ainda. Log completo (com todo tipo de ação, não só essas 4
// tabelas) fica pra uma versão futura, quando essa tabela existir.
export async function getLogSistema(): Promise<LogSistemaEntrada[]> {
  await requireRole("admin");

  const supabase = await createClient();

  const [{ data: webhooksData }, { data: presencasData }, { data: parcelasData }, { data: certificadosData }] =
    await Promise.all([
      supabase
        .from("log_webhooks_asaas")
        .select("id, evento, created_at, asaas_payment_id")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("presencas")
        .select("id, status, created_at, created_by")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("parcelas")
        .select("id, status, updated_at, created_by")
        .order("updated_at", { ascending: false })
        .limit(15),
      supabase
        .from("certificados")
        .select("id, status, updated_at, created_by")
        .order("updated_at", { ascending: false })
        .limit(15),
    ]);

  const idsUsuarios = new Set<string>();
  for (const presenca of presencasData ?? []) idsUsuarios.add(presenca.created_by);
  for (const parcela of parcelasData ?? []) idsUsuarios.add(parcela.created_by);
  for (const certificado of certificadosData ?? []) idsUsuarios.add(certificado.created_by);

  const { data: perfisData } =
    idsUsuarios.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(idsUsuarios))
      : { data: [] as { id: string; full_name: string | null }[] };

  const nomePorId = new Map((perfisData ?? []).map((perfil) => [perfil.id, perfil.full_name ?? "—"]));

  const entradas: LogSistemaEntrada[] = [
    ...(webhooksData ?? []).map((webhook) => ({
      id: `webhook-${webhook.id}`,
      dataHora: webhook.created_at,
      tipo: "webhook_asaas" as const,
      descricao: `Webhook Asaas: ${webhook.evento}${webhook.asaas_payment_id ? ` (${webhook.asaas_payment_id})` : ""}`,
      usuario: "Sistema (Asaas)",
    })),
    ...(presencasData ?? []).map((presenca) => ({
      id: `presenca-${presenca.id}`,
      dataHora: presenca.created_at,
      tipo: "presenca" as const,
      descricao: `Presença registrada: ${PRESENCA_STATUS_LABELS[presenca.status as (typeof PRESENCA_STATUSES)[number]]}`,
      usuario: nomePorId.get(presenca.created_by) ?? "—",
    })),
    ...(parcelasData ?? []).map((parcela) => ({
      id: `parcela-${parcela.id}`,
      dataHora: parcela.updated_at,
      tipo: "parcela" as const,
      descricao: `Parcela atualizada: ${PARCELA_STATUS_LABELS[parcela.status as keyof typeof PARCELA_STATUS_LABELS]}`,
      usuario: nomePorId.get(parcela.created_by) ?? "—",
    })),
    ...(certificadosData ?? []).map((certificado) => ({
      id: `certificado-${certificado.id}`,
      dataHora: certificado.updated_at,
      tipo: "certificado" as const,
      descricao: `Certificado: ${CERTIFICADO_STATUS_LABELS[certificado.status] ?? certificado.status}`,
      usuario: nomePorId.get(certificado.created_by) ?? "—",
    })),
  ];

  entradas.sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));
  return entradas.slice(0, 50);
}

// ===== Banners do login (TAREFA 5) =====
//
// O upload do arquivo em si acontece do lado do client, direto pro
// Supabase Storage (src/components/admin/banners-login-form.tsx usa
// @/lib/supabase/client, com a sessão do próprio admin já autenticado) —
// não passa pelo body de uma Server Action, que tem limite de tamanho
// configurado em next.config.ts. Essa action só grava os metadados
// (storage_path/public_url já prontos) na tabela.

export async function getBannersLoginAdmin(): Promise<LoginBanner[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("login_banners").select("*").order("ordem", { ascending: true });

  return (data as LoginBanner[] | null) ?? [];
}

export async function uploadBannerLogin(formData: FormData): Promise<{ error?: string }> {
  await requireRole("admin");

  const storagePath = String(formData.get("storage_path") ?? "");
  const publicUrl = String(formData.get("public_url") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const subtitulo = String(formData.get("subtitulo") ?? "").trim();
  const tipoRaw = String(formData.get("tipo") ?? "");
  const tipo: LoginBannerTipo = LOGIN_BANNER_TIPOS.includes(tipoRaw as LoginBannerTipo)
    ? (tipoRaw as LoginBannerTipo)
    : "admin";

  if (!storagePath || !publicUrl) {
    return { error: "Upload da imagem falhou antes de salvar o registro. Tente novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("login_banners").insert({
    storage_path: storagePath,
    public_url: publicUrl,
    titulo: titulo || null,
    subtitulo: subtitulo || null,
    tipo,
  });

  if (error) {
    return { error: "Não foi possível salvar o banner. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export async function updateBannerLogin(
  id: string,
  dados: {
    titulo: string;
    subtitulo: string;
    ordem: number;
    ativo: boolean;
    titulo_tamanho: LoginBannerTamanho;
    subtitulo_tamanho: LoginBannerTamanho;
    titulo_cor: string;
    subtitulo_cor: string;
  },
): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = bannerLoginUpdateSchema.safeParse({
    titulo: dados.titulo || undefined,
    subtitulo: dados.subtitulo || undefined,
    ordem: dados.ordem,
    ativo: dados.ativo,
    titulo_tamanho: dados.titulo_tamanho,
    subtitulo_tamanho: dados.subtitulo_tamanho,
    titulo_cor: dados.titulo_cor,
    subtitulo_cor: dados.subtitulo_cor,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("login_banners")
    .update({
      titulo: parsed.data.titulo ?? null,
      subtitulo: parsed.data.subtitulo ?? null,
      ordem: parsed.data.ordem,
      ativo: parsed.data.ativo,
      titulo_tamanho: parsed.data.titulo_tamanho,
      subtitulo_tamanho: parsed.data.subtitulo_tamanho,
      titulo_cor: parsed.data.titulo_cor,
      subtitulo_cor: parsed.data.subtitulo_cor,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

// Lógica anti-acúmulo: remove o arquivo do Storage antes de apagar a
// linha — usa o storage_path salvo na própria tabela, não recalcula nada.
export async function deleteBannerLogin(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: banner } = await supabase
    .from("login_banners")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!banner) {
    return { error: "Banner não encontrado." };
  }

  const { error: storageError } = await supabase.storage.from(BANNER_BUCKET).remove([banner.storage_path]);
  if (storageError) {
    return { error: "Não foi possível remover o arquivo do Storage. Tente novamente." };
  }

  const { error } = await supabase.from("login_banners").delete().eq("id", id);
  if (error) {
    return { error: "Arquivo removido do Storage, mas não foi possível excluir o registro. Contate o suporte." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

// ===== Rodapé da tela de login (TAREFA 4) =====

const RODAPE_LOGIN_MAX_LENGTH = 300;

export async function salvarRodapeLogin(texto: string): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const rodape = texto.trim();
  if (rodape.length > RODAPE_LOGIN_MAX_LENGTH) {
    return { error: `O texto do rodapé pode ter no máximo ${RODAPE_LOGIN_MAX_LENGTH} caracteres.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({ login_rodape: rodape || null, updated_by: user.id })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar o rodapé. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/login");
  revalidatePath("/entrar");
  return {};
}

// ===== Logomarca da escola (TAREFA 5) =====
//
// Mesmo padrão dos banners do login: o upload do arquivo em si acontece do
// lado do client, direto pro Supabase Storage (ver
// src/components/admin/logo-escola-form.tsx) — essa action só grava a
// URL/path já prontos na tabela. A exclusão do arquivo anterior no
// Storage também acontece no client, antes de chamar essa action.

export async function salvarLogoEscola(logoUrl: string, logoPath: string): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  if (!logoUrl || !logoPath) {
    return { error: "Upload da logo falhou antes de salvar. Tente novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({ escola_logo_url: logoUrl, escola_logo_path: logoPath, updated_by: user.id })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar a logo. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/login");
  revalidatePath("/entrar");
  return {};
}

export async function removerLogoEscola(): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({ escola_logo_url: null, escola_logo_path: null, updated_by: user.id })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível remover a logo. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/login");
  revalidatePath("/entrar");
  return {};
}
