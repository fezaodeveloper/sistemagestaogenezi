import "server-only";

import { escapeHtml } from "@/lib/telegram";
import { enviarMensagemTelegram } from "@/lib/telegram/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarConfigWhatsapp } from "@/lib/whatsapp/config";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";

// /avisar envia WhatsApp em sequência (delay anti-banimento embutido em enviarWhatsApp) — pra
// uma turma com várias matrículas isso pode passar de 30s. Mesmo teto já usado pelo cron
// whatsapp-fluxos e por outras rotas desta natureza de envio em massa.
export const maxDuration = 60;

type AdminClient = ReturnType<typeof createAdminClient>;

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
};

// ===== Estado em memória do fluxo /avisar =====
//
// LIMITAÇÃO CONHECIDA: Map em memória do processo — sobrevive entre invocações só enquanto a
// mesma instância serverless ficar "quente" (sem garantia formal da Vercel). Numa instância fria
// nova, ou se duas chamadas caírem em instâncias diferentes, o estado se perde e o fluxo
// /avisar reinicia do zero sem aviso (o usuário só notaria uma resposta "fora de contexto").
// Resolver de verdade exigiria uma tabela no banco — fora do escopo pedido (restrição explícita
// de não criar migration).
type ItemLista = { id: string; nome: string; telefone: string | null };
type EstadoAvisar = {
  etapa: "aguardando_destino" | "aguardando_selecao" | "aguardando_mensagem";
  destinoTipo: "aluno" | "turma" | null;
  lista: ItemLista[];
  telefones: string[];
  destinoNome: string | null;
};
const estadosAvisar = new Map<number, EstadoAvisar>();

// ===== Helpers de data/hora (Brasília) =====

function hojeISO(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split("/").reverse().join("-");
}

function amanhaISO(): string {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  return amanha.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split("/").reverse().join("-");
}

function horaBrasilia(): string {
  return new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

function dataExtenso(): string {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

const MENSAGEM_AJUDA = [
  "🤖 <b>Bot da Gênezi</b>",
  "",
  "Comandos disponíveis:",
  "/resumo — Resumo do dia (matrículas, financeiro, aulas)",
  "/alunos_amanha — Alunos com aula amanhã + telefones",
  "/avisar — Enviar WhatsApp para aluno ou turma",
  "/status — Verifica se o bot está online",
  "/ajuda — Exibe esta mensagem",
].join("\n");

// ===== /resumo =====

// Conta quantas aulas (sessões) de turmas ativas liberam HOJE. "aulas" não tem data própria —
// cada turma tem sua cadência semanal, e a data de cada sessão é CALCULADA pela RPC
// calendario_aulas_turma (mesma usada pelo cron lembretes-aula) — não existe filtro direto por
// data na tabela aulas.
async function contarAulasHoje(admin: AdminClient, hoje: string): Promise<number> {
  try {
    const { data: turmasAtivas } = await admin.from("turmas").select("id").eq("status", "ativa");
    let total = 0;
    for (const turma of (turmasAtivas ?? []) as { id: string }[]) {
      try {
        const { data: calendario } = await admin.rpc("calendario_aulas_turma", { p_turma_id: turma.id });
        total += ((calendario ?? []) as { data_liberacao: string }[]).filter((c) => c.data_liberacao === hoje).length;
      } catch {
        // Ignora essa turma (ex.: cadência mal configurada) — soma só o que já deu pra calcular.
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function resumoDoDia(): Promise<string> {
  const admin = createAdminClient();
  const hoje = hojeISO();
  const inicioHoje = `${hoje}T00:00:00-03:00`;
  const fimHoje = `${hoje}T23:59:59-03:00`;

  async function contar(fn: () => Promise<number | null>): Promise<number> {
    try {
      return (await fn()) ?? 0;
    } catch {
      return 0;
    }
  }

  const matriculasHoje = await contar(async () => {
    const { count } = await admin
      .from("matriculas")
      .select("id", { count: "exact", head: true })
      .gte("created_at", inicioHoje)
      .lte("created_at", fimHoje);
    return count;
  });

  const matriculasAtivas = await contar(async () => {
    const { count } = await admin.from("matriculas").select("id", { count: "exact", head: true }).eq("status", "ativa");
    return count;
  });

  const { quantidade: atrasadasQtd, soma: atrasadasSoma } = await (async () => {
    try {
      const { data } = await admin.from("parcelas").select("valor").eq("status", "atrasado");
      const linhas = (data ?? []) as { valor: number }[];
      return { quantidade: linhas.length, soma: linhas.reduce((s, p) => s + Number(p.valor), 0) };
    } catch {
      return { quantidade: 0, soma: 0 };
    }
  })();

  // data_pagamento é "date" (sem hora) — comparação exata com o dia de hoje, sem faixa de horário.
  const { quantidade: pagasQtd, soma: pagasSoma } = await (async () => {
    try {
      const { data } = await admin.from("parcelas").select("valor").eq("data_pagamento", hoje);
      const linhas = (data ?? []) as { valor: number }[];
      return { quantidade: linhas.length, soma: linhas.reduce((s, p) => s + Number(p.valor), 0) };
    } catch {
      return { quantidade: 0, soma: 0 };
    }
  })();

  const aulasHoje = await contarAulasHoje(admin, hoje);

  const leadsHoje = await contar(async () => {
    const { count } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", inicioHoje)
      .lte("created_at", fimHoje);
    return count;
  });

  const mensagensHoje = await contar(async () => {
    const { count } = await admin
      .from("whatsapp_mensagens_recebidas")
      .select("id", { count: "exact", head: true })
      .gte("created_at", inicioHoje)
      .lte("created_at", fimHoje);
    return count;
  });

  const fluxosAndamento = await contar(async () => {
    const { count } = await admin
      .from("whatsapp_fluxos_execucoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "em_andamento");
    return count;
  });

  return [
    "📊 <b>Resumo do Dia — Gênezi</b>",
    `🗓 ${dataExtenso()}`,
    "",
    "🎓 <b>Matrículas</b>",
    `- Novas hoje: ${matriculasHoje}`,
    `- Ativas total: ${matriculasAtivas}`,
    "",
    "💰 <b>Financeiro</b>",
    `- Recebido hoje: ${pagasQtd} cobrança(s) — ${formatarBRL(pagasSoma)}`,
    `- Em atraso: ${atrasadasQtd} cobrança(s) — ${formatarBRL(atrasadasSoma)}`,
    "",
    "📚 <b>Aulas</b>",
    `- Hoje: ${aulasHoje} aula(s)`,
    "",
    "🎯 <b>Leads</b>",
    `- Novos hoje: ${leadsHoje}`,
    "",
    "📱 <b>WhatsApp</b>",
    `- Mensagens recebidas hoje: ${mensagensHoje}`,
    `- Fluxos em andamento: ${fluxosAndamento}`,
    "",
    `🕐 Atualizado às ${horaBrasilia()} (Brasília)`,
  ].join("\n");
}

// ===== /alunos_amanha =====

type LinhaAlunoTurma = { nome: string; telefone: string | null };

async function alunosAmanha(): Promise<string> {
  try {
    const admin = createAdminClient();
    const amanha = amanhaISO();

    const { data: turmasAtivas } = await admin.from("turmas").select("id, nome, horario_aula").eq("status", "ativa");

    const porTurma: { turmaNome: string; horario: string; alunos: LinhaAlunoTurma[] }[] = [];

    for (const turma of (turmasAtivas ?? []) as { id: string; nome: string; horario_aula: string | null }[]) {
      const { data: calendario } = await admin.rpc("calendario_aulas_turma", { p_turma_id: turma.id });
      const temAulaAmanha = ((calendario ?? []) as { data_liberacao: string }[]).some((c) => c.data_liberacao === amanha);
      if (!temAulaAmanha) continue;

      // alunos não tem coluna "nome" — vem de profiles.full_name (alunos.id referencia profiles.id).
      const { data: matriculasTurma } = await admin
        .from("matriculas")
        .select("alunos(telefone, profiles!alunos_id_fkey(full_name))")
        .eq("turma_id", turma.id)
        .eq("status", "ativa");

      const alunos = (
        (matriculasTurma ?? []) as unknown as { alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null }[]
      )
        .map((m) => ({ nome: m.alunos?.profiles?.full_name ?? "aluno(a)", telefone: m.alunos?.telefone ?? null }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      if (alunos.length > 0) {
        porTurma.push({ turmaNome: turma.nome, horario: turma.horario_aula ?? "—", alunos });
      }
    }

    const totalAlunos = porTurma.reduce((soma, t) => soma + t.alunos.length, 0);
    if (totalAlunos === 0) return "📚 Nenhuma aula agendada para amanhã.";

    const LIMITE = 20;
    let contados = 0;
    const linhas = ["📚 <b>Alunos com aula amanhã</b>", ""];

    for (const turma of porTurma) {
      if (contados >= LIMITE) break;
      linhas.push(`<b>${escapeHtml(turma.turmaNome)} — ${escapeHtml(turma.horario)}</b>`);
      for (const aluno of turma.alunos) {
        if (contados >= LIMITE) break;
        linhas.push(`- ${escapeHtml(aluno.nome)} — ${aluno.telefone ? escapeHtml(aluno.telefone) : "(sem telefone)"}`);
        contados++;
      }
      linhas.push("");
    }

    if (totalAlunos > LIMITE) linhas.push(`...e mais ${totalAlunos - LIMITE} alunos.`);
    linhas.push(`Total: ${totalAlunos} aluno(s)`);

    return linhas.join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em alunosAmanha", erro);
    return "⚠️ Não foi possível buscar os alunos de amanhã. Tente novamente.";
  }
}

// ===== /avisar =====

// enviarWhatsApp (não um fetch cru à Evolution API): normaliza telefone, lê a config real
// (URL/instância/chave) da tabela whatsapp_config, confere conexão e aplica o delay
// anti-banimento — tudo isso não existe como env var neste projeto (confirmado antes de
// implementar). Sequencial de propósito, mesmo padrão de todo outro envio em massa do GênZap.
async function enviarParaTelefones(telefones: string[], mensagem: string): Promise<number> {
  let enviadas = 0;
  for (const telefone of telefones) {
    try {
      const resultado = await enviarWhatsApp(telefone, mensagem);
      if (resultado.ok && resultado.enviado) enviadas++;
    } catch {
      // best-effort — ignora falha individual, segue pro próximo telefone.
    }
  }
  return enviadas;
}

async function processarEstadoAvisar(chatId: number, texto: string): Promise<void> {
  const estado = estadosAvisar.get(chatId);
  if (!estado) return;
  const admin = createAdminClient();

  if (estado.etapa === "aguardando_destino") {
    if (texto === "1") {
      const { data } = await admin
        .from("alunos")
        .select("id, telefone, profiles!alunos_id_fkey(full_name)")
        .not("telefone", "is", null)
        .limit(200);

      const lista: ItemLista[] = (
        (data ?? []) as unknown as { id: string; telefone: string | null; profiles: { full_name: string | null } | null }[]
      )
        .map((a) => ({ id: a.id, nome: a.profiles?.full_name ?? "aluno(a)", telefone: a.telefone }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, 30);

      if (lista.length === 0) {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram("Nenhum aluno com telefone cadastrado encontrado.", String(chatId));
        return;
      }

      const linhas = ["👤 <b>Selecione o aluno pelo número:</b>", ...lista.map((a, i) => `${i + 1}. ${escapeHtml(a.nome)} — ${a.telefone ?? "—"}`)];
      if (lista.length === 30) linhas.push("", "Mostrando os primeiros 30.");
      await enviarMensagemTelegram(linhas.join("\n"), String(chatId));
      estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_selecao", destinoTipo: "aluno", lista });
      return;
    }

    if (texto === "2") {
      const { data } = await admin.from("turmas").select("id, nome").eq("status", "ativa").order("nome");
      const lista: ItemLista[] = ((data ?? []) as { id: string; nome: string }[]).map((t) => ({ id: t.id, nome: t.nome, telefone: null }));

      if (lista.length === 0) {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram("Nenhuma turma ativa encontrada.", String(chatId));
        return;
      }

      const linhas = ["🏫 <b>Selecione a turma pelo número:</b>", ...lista.map((t, i) => `${i + 1}. ${escapeHtml(t.nome)}`)];
      await enviarMensagemTelegram(linhas.join("\n"), String(chatId));
      estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_selecao", destinoTipo: "turma", lista });
      return;
    }

    await enviarMensagemTelegram("Responda com 1 (aluno) ou 2 (turma).", String(chatId));
    return;
  }

  if (estado.etapa === "aguardando_selecao") {
    const n = Number.parseInt(texto, 10);
    if (!Number.isInteger(n) || n < 1 || n > estado.lista.length) {
      await enviarMensagemTelegram("Número inválido. Tente novamente.", String(chatId));
      return;
    }
    const item = estado.lista[n - 1];

    if (estado.destinoTipo === "aluno") {
      if (!item.telefone) {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram("Esse aluno não tem telefone cadastrado.", String(chatId));
        return;
      }
      await enviarMensagemTelegram(
        `✅ <b>Destinatário:</b> ${escapeHtml(item.nome)}\n📞 1 número encontrado\n\n✍️ Digite agora a mensagem a enviar via WhatsApp.\n(ou /cancelar para abortar)`,
        String(chatId),
      );
      estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_mensagem", telefones: [item.telefone], destinoNome: item.nome });
      return;
    }

    // destinoTipo === "turma"
    const { data: matriculasTurma } = await admin
      .from("matriculas")
      .select("alunos(telefone)")
      .eq("turma_id", item.id)
      .eq("status", "ativa");

    const telefones = [
      ...new Set(
        ((matriculasTurma ?? []) as unknown as { alunos: { telefone: string | null } | null }[])
          .map((m) => m.alunos?.telefone)
          .filter((t): t is string => !!t),
      ),
    ];

    if (telefones.length === 0) {
      estadosAvisar.delete(chatId);
      await enviarMensagemTelegram("Essa turma não tem alunos com telefone cadastrado.", String(chatId));
      return;
    }

    const destinoNome = `${item.nome} (${telefones.length} alunos)`;
    await enviarMensagemTelegram(
      `✅ <b>Destinatário:</b> ${escapeHtml(destinoNome)}\n📞 ${telefones.length} número(s) encontrado(s)\n\n✍️ Digite agora a mensagem a enviar via WhatsApp.\n(ou /cancelar para abortar)`,
      String(chatId),
    );
    estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_mensagem", telefones, destinoNome });
    return;
  }

  // etapa === "aguardando_mensagem"
  const config = await carregarConfigWhatsapp();
  if (!config.evolution || config.status !== "conectado") {
    estadosAvisar.delete(chatId);
    console.warn("[telegram:avisar] GênZap (Evolution API) não está configurado/conectado");
    await enviarMensagemTelegram("⚠️ Envio não configurado. Contate o administrador.", String(chatId));
    return;
  }

  const enviadas = await enviarParaTelefones(estado.telefones, texto);
  estadosAvisar.delete(chatId);
  const preview = texto.length > 80 ? `${texto.slice(0, 80)}...` : texto;
  await enviarMensagemTelegram(`✅ Mensagem enviada para ${enviadas} contato(s)!\n📝 "${escapeHtml(preview)}"`, String(chatId));
}

// Webhook de ENTRADA do bot @genezi_educacao_bot (Fase 3.1 + 3.2) — mesmo padrão de
// src/app/api/webhooks/evolution/route.ts: autentica por header, sempre responde 200 (nunca
// deixa o Telegram reenviar por erro interno/comando inválido/secret errado).
//
// Registrar com setWebhook + secret_token = TELEGRAM_WEBHOOK_SECRET (ver .env.example) — o
// Telegram então manda esse mesmo valor no header "x-telegram-bot-api-secret-token" em toda
// chamada, sem precisar de query string nem path secreto.
//
// Responde SEMPRE no chatId do remetente (message.chat.id), nunca no TELEGRAM_CHAT_ID fixo do
// grupo — funciona tanto em grupo quanto em chat privado com o bot.
export async function POST(request: Request): Promise<Response> {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("OK", { status: 200 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  const chatId = message?.chat?.id;
  const texto = message?.text?.trim();

  try {
    // Estado ativo de /avisar tem prioridade sobre o switch de comandos — qualquer texto do
    // usuário nessa janela é resposta ao passo atual do fluxo, não um comando novo.
    if (chatId && texto && estadosAvisar.has(chatId)) {
      if (texto.toLowerCase() === "/cancelar") {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram("❌ Operação cancelada.", String(chatId));
      } else {
        await processarEstadoAvisar(chatId, texto);
      }
      return new Response("OK", { status: 200 });
    }

    if (!chatId || !texto) return new Response("OK", { status: 200 });

    // Normaliza comando — grupos enviam "/cmd@nomedobot".
    const cmd = texto.split("@")[0].toLowerCase();
    if (!cmd.startsWith("/")) return new Response("OK", { status: 200 });

    const username = message?.from?.username ?? message?.from?.first_name ?? "usuário";
    console.log(`[telegram:webhook] comando "${cmd}" de ${username} (chat ${chatId})`);

    switch (cmd) {
      case "/start":
      case "/ajuda":
        await enviarMensagemTelegram(MENSAGEM_AJUDA, String(chatId));
        break;
      case "/status":
        // Data + hora completos (não só a hora) — mesmo formato da Fase 3.1, mantido sem mudança.
        await enviarMensagemTelegram(
          `✅ <b>Bot online</b>\n🕐 ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          String(chatId),
        );
        break;
      case "/resumo": {
        const msg = await resumoDoDia();
        await enviarMensagemTelegram(msg, String(chatId));
        break;
      }
      case "/alunos_amanha": {
        const msg = await alunosAmanha();
        await enviarMensagemTelegram(msg, String(chatId));
        break;
      }
      case "/avisar":
        estadosAvisar.set(chatId, { etapa: "aguardando_destino", destinoTipo: null, lista: [], telefones: [], destinoNome: null });
        await enviarMensagemTelegram(
          "📣 <b>Avisar — Passo 1/3</b>\n\nPara quem deseja enviar?\n1️⃣ Para um aluno específico\n2️⃣ Para uma turma inteira\n\nResponda com 1 ou 2.",
          String(chatId),
        );
        break;
      default:
        await enviarMensagemTelegram("Comando não reconhecido. Use /ajuda para ver os disponíveis.", String(chatId));
    }
  } catch (err) {
    console.error("[telegram:webhook] erro ao processar update:", err);
  }

  return new Response("OK", { status: 200 });
}
