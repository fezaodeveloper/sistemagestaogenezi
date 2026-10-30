import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagemTelegram } from "@/lib/telegram/client";
import { escapeHtml } from "@/lib/telegram";

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

// Mesmo helper duplicado em outros arquivos do projeto (ver urlPortal() em
// src/lib/whatsapp/eventos.ts) — não centralizado de propósito, convenção já adotada aqui.
function urlPortal(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

type ConfigTelegramConecta = {
  chatId: string | null;
  notificarNovoCandidato: boolean;
  notificarNovaEmpresa: boolean;
};

// O Telegram do Gênezi Conecta usa um chat/grupo SEPARADO do Telegram geral da escola
// (TELEGRAM_CHAT_ID, env var usada como default por enviarMensagemTelegram/enviarAlertaTelegram
// quando nenhum chat_id explícito é passado) — por isso lê telegram_conecta_chat_id direto de
// configuracoes e sempre passa esse chatId explícito, em vez de reusar
// telegramNotifHabilitada()/enviarAlertaTelegram() (atrelados ao chat geral, ver
// src/lib/automacoes/handlers/telegram.ts). Sem cache: disparado em cadastro/ativação/webhook,
// eventos pouco frequentes — não justifica a complexidade de TTL que
// src/lib/telegram/verificar-toggle.ts tem pra notificações de alto volume.
async function lerConfigTelegramConecta(): Promise<ConfigTelegramConecta> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("configuracoes")
    .select("telegram_conecta_chat_id, tg_conecta_novo_candidato, tg_conecta_nova_empresa")
    .eq("id", true)
    .maybeSingle();

  return {
    chatId: data?.telegram_conecta_chat_id?.trim() || null,
    notificarNovoCandidato: data?.tg_conecta_novo_candidato ?? true,
    notificarNovaEmpresa: data?.tg_conecta_nova_empresa ?? true,
  };
}

const TIPO_LABEL: Record<"aluno" | "externo", string> = {
  aluno: "Aluno Gênezi",
  externo: "Candidato externo",
};

// Best-effort — nunca lança (mesma política de todo o resto do projeto pra notificação, ver
// handlers/telegram.ts): falha aqui nunca pode voltar a afetar o cadastro/ativação/pagamento
// que já foi confirmado com sucesso antes desta chamada.
export async function notificarNovoCandidatoTelegram(perfil: {
  nome: string;
  tipo: "aluno" | "externo";
  cidade: string | null;
  estado: string | null;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovoCandidato) return;

    const mensagem = [
      "🎯 <b>Novo candidato no Gênezi Conecta</b>",
      "",
      `👤 Nome: ${escapeHtml(perfil.nome)}`,
      `📍 Cidade: ${escapeHtml(perfil.cidade ?? "—")} - ${escapeHtml(perfil.estado ?? "—")}`,
      `🏷️ Tipo: ${TIPO_LABEL[perfil.tipo]}`,
      "",
      `Acesse o painel: ${urlPortal()}/admin/conecta/candidatos`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário acima.
  }
}

// As 4 funções abaixo (TAREFA: notificações Telegram do ciclo de vida da candidatura)
// reaproveitam o mesmo toggle "notificarNovoCandidato" de configuracoes — não existe (nem foi
// pedida) uma coluna de toggle separada por tipo de evento, então todo evento do ciclo de vida
// de um candidato (nova candidatura, contratação, rejeição, aluno ficou visível) fica atrás do
// mesmo liga/desliga já existente no admin.

export async function notificarCandidaturaRealizada(dados: {
  vagaTitulo: string;
  nomeAluno: string;
  nomeEmpresa: string;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovoCandidato) return;

    const mensagem = [
      "📋 <b>Nova candidatura!</b>",
      `👤 ${escapeHtml(dados.nomeAluno)}`,
      `💼 Vaga: ${escapeHtml(dados.vagaTitulo)}`,
      `🏢 Empresa: ${escapeHtml(dados.nomeEmpresa)}`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário em notificarNovoCandidatoTelegram.
  }
}

export async function notificarCandidatoContratado(dados: {
  vagaTitulo: string;
  nomeAluno: string;
  nomeEmpresa: string;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovoCandidato) return;

    const mensagem = [
      "🎉 <b>Contratação!</b>",
      `👤 ${escapeHtml(dados.nomeAluno)} foi contratado!`,
      `💼 Vaga: ${escapeHtml(dados.vagaTitulo)}`,
      `🏢 Empresa: ${escapeHtml(dados.nomeEmpresa)}`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário em notificarNovoCandidatoTelegram.
  }
}

export async function notificarCandidatoRejeitado(dados: {
  vagaTitulo: string;
  nomeAluno: string;
  nomeEmpresa: string;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovoCandidato) return;

    const mensagem = [
      "❌ <b>Rejeição</b>",
      `👤 ${escapeHtml(dados.nomeAluno)}`,
      `💼 Vaga: ${escapeHtml(dados.vagaTitulo)}`,
      `🏢 Empresa: ${escapeHtml(dados.nomeEmpresa)}`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário em notificarNovoCandidatoTelegram.
  }
}

// Substitui a chamada genérica notificarNovoCandidatoTelegram (acima) no ponto em que o aluno
// ativa a visibilidade — mesmo evento, mensagem mais específica: antes de existir essa função,
// toggleVisibilidadePerfil chamava notificarNovoCandidatoTelegram com tipo:"aluno" hardcoded ali,
// o que soava como "candidato novo" mesmo pra um aluno só reativando a visibilidade depois de
// meses. Não é uma notificação ADICIONAL: é a mesma, com texto mais preciso.
export async function notificarAlunoAtivouVisibilidade(dados: {
  nomeAluno: string;
  cidade: string | null;
  estado: string | null;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovoCandidato) return;

    const mensagem = [
      "👁️ <b>Aluno visível!</b>",
      `👤 ${escapeHtml(dados.nomeAluno)}`,
      `📍 ${escapeHtml(dados.cidade ?? "—")}/${escapeHtml(dados.estado ?? "—")}`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário em notificarNovoCandidatoTelegram.
  }
}

// TAREFA: empresa deixou de ser gratuita — avisa o admin quando a assinatura anual é confirmada
// pelo webhook (diferente de notificarNovaEmpresaTelegram, que avisa no CADASTRO, antes de
// pagar).
export async function notificarEmpresaPagamentoConfirmado(empresa: {
  nome: string;
  cidade: string | null;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovaEmpresa) return;

    const mensagem = [
      "💰 <b>Empresa pagou a assinatura!</b>",
      `🏪 Empresa: ${escapeHtml(empresa.nome)}`,
      `📍 Cidade: ${escapeHtml(empresa.cidade ?? "—")}`,
      "",
      `Acesse o painel: ${urlPortal()}/admin/conecta`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário em notificarNovoCandidatoTelegram.
  }
}

export async function notificarNovaEmpresaTelegram(empresa: {
  nome: string;
  cidade: string | null;
  email: string;
}): Promise<void> {
  try {
    const config = await lerConfigTelegramConecta();
    if (!config.chatId || !config.notificarNovaEmpresa) return;

    const mensagem = [
      "🏢 <b>Nova empresa no Gênezi Conecta</b>",
      "",
      `🏪 Empresa: ${escapeHtml(empresa.nome)}`,
      `📍 Cidade: ${escapeHtml(empresa.cidade ?? "—")}`,
      `📧 Email: ${escapeHtml(empresa.email)}`,
      "",
      "⏳ Aguarda aprovação:",
      `${urlPortal()}/admin/conecta`,
    ].join("\n");

    await enviarMensagemTelegram(mensagem, config.chatId);
  } catch {
    // Best-effort — ver comentário acima.
  }
}
