import "server-only";

import { escapeHtml } from "@/lib/telegram";
import { enviarMensagemTelegram, responderCallbackQuery, type TelegramReplyMarkup } from "@/lib/telegram/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarConfigWhatsapp } from "@/lib/whatsapp/config";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";

// /avisar envia WhatsApp em sequência (delay anti-banimento embutido em enviarWhatsApp) — pra
// uma turma com várias matrículas isso pode passar de 30s. Mesmo teto já usado pelo cron
// whatsapp-fluxos e por outras rotas desta natureza de envio em massa.
export const maxDuration = 60;

type AdminClient = ReturnType<typeof createAdminClient>;

// Whitelist de chat IDs autorizados a usar o bot — sem isso, qualquer pessoa que descobrisse
// @genezi_educacao_bot e mandasse /avisar conseguiria disparar WhatsApp em massa pra alunos
// reais. 8473682147 é o chat pessoal do @genezidev; TELEGRAM_CHAT_ID (grupo/chat do Fernando)
// vem do .env.
const ALLOWED_CHAT_IDS = new Set([8473682147, Number(process.env.TELEGRAM_CHAT_ID ?? "0")].filter(Boolean));

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string };
    message?: { chat: { id: number } };
    data?: string;
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

// Converte "YYYY-MM-DD" (campo "date" do Postgres, sem hora/timezone) pra "DD/MM/YYYY" por
// manipulação de string — nunca via Date(), que reinterpretaria o valor no timezone do runtime.
function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

const MENSAGEM_AJUDA = [
  "🤖 <b>Bot da Gênezi</b>",
  "",
  "Comandos disponíveis:",
  "/menu — Exibe o teclado de atalhos",
  "/resumo — Resumo do dia (matrículas, financeiro, aulas)",
  "/alunos_amanha — Alunos com aula amanhã + telefones",
  "/inadimplencia — Alunos com parcelas atrasadas",
  "/vencendo — Parcelas vencendo amanhã",
  "/leads — Leads sem contato",
  "/resgates — Resgates pendentes de entrega",
  "/agenda — Agendamentos de hoje",
  "/frequencia — Alunos com baixa frequência (últimas 4 semanas)",
  "/estoque — Itens com estoque baixo",
  "/avisar — Enviar WhatsApp para aluno, turma ou todos",
  "/status — Verifica se o bot está online",
  "/ajuda — Exibe esta mensagem",
].join("\n");

const TECLADO_RESUMO: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "resumo:atualizar" }]] };
const TECLADO_ALUNOS_AMANHA: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "alunos:atualizar" }]] };
const TECLADO_INADIMPLENCIA: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "inadimplencia:atualizar" }]] };
const TECLADO_VENCENDO: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "vencendo:atualizar" }]] };
const TECLADO_LEADS: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "leads:atualizar" }]] };
const TECLADO_RESGATES: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "resgates:atualizar" }]] };
const TECLADO_AGENDA: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "agenda:atualizar" }]] };
const TECLADO_FREQUENCIA: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "frequencia:atualizar" }]] };
const TECLADO_ESTOQUE: TelegramReplyMarkup = { inline_keyboard: [[{ text: "🔄 Atualizar", callback_data: "estoque:atualizar" }]] };

// Anexado em toda etapa do /avisar que só aceita texto livre (aguardando_mensagem) — sem isso,
// cancelar só era possível digitando "/cancelar" nessas etapas, diferente das demais (que já têm
// o botão via montarTecladoSelecao).
const TECLADO_CANCELAR_AVISAR: TelegramReplyMarkup = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "avisar:cancelar" }]] };

// Teclado fixo (ReplyKeyboardMarkup) — substitui o teclado do celular por botões de atalho.
// Clicar num desses botões não dispara callback_query (isso só existe pra inline_keyboard);
// o Telegram só envia o texto do botão como mensagem normal, por isso o mapeamento MAP_BOTAO
// mais abaixo, que traduz esse texto de volta pro comando correspondente.
const REPLY_KEYBOARD: TelegramReplyMarkup = {
  keyboard: [
    [{ text: "📊 Resumo do Dia" }, { text: "📚 Alunos Amanhã" }],
    [{ text: "💸 Inadimplência" }, { text: "📋 Vencendo Amanhã" }],
    [{ text: "🎯 Leads" }, { text: "🏆 Resgates" }],
    [{ text: "📅 Agenda Hoje" }, { text: "📊 Frequência" }],
    [{ text: "📦 Estoque" }, { text: "📣 Avisar" }],
    [{ text: "✅ Status" }, { text: "❓ Ajuda" }],
  ],
  resize_keyboard: true,
  persistent: true,
};

const MAP_BOTAO: Record<string, string> = {
  "📊 resumo do dia": "/resumo",
  "📚 alunos amanhã": "/alunos_amanha",
  "💸 inadimplência": "/inadimplencia",
  "📋 vencendo amanhã": "/vencendo",
  "🎯 leads": "/leads",
  "🏆 resgates": "/resgates",
  "📅 agenda hoje": "/agenda",
  "📊 frequência": "/frequencia",
  "📦 estoque": "/estoque",
  "📣 avisar": "/avisar",
  "✅ status": "/status",
  "❓ ajuda": "/ajuda",
};

// Máximo de botões de seleção por lista — Telegram aceita até 100 botões por mensagem, mas a
// UX piora com muitos; listas maiores continuam disponíveis como texto numerado (ver
// enviarListaParaSelecao), então digitar o número de qualquer item sempre funciona, botão ou não.
const MAX_BOTOES_LISTA = 8;

function montarTecladoSelecao(lista: ItemLista[], prefixo: "aluno" | "turma", porLinha: 1 | 2): TelegramReplyMarkup {
  const visiveis = lista.slice(0, MAX_BOTOES_LISTA);
  const linhas: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < visiveis.length; i += porLinha) {
    const linha = visiveis.slice(i, i + porLinha).map((item, offset) => ({
      text: item.nome.length > 40 ? `${item.nome.slice(0, 40)}…` : item.nome,
      callback_data: `avisar:${prefixo}:${i + offset}`,
    }));
    linhas.push(linha);
  }
  linhas.push([{ text: "❌ Cancelar", callback_data: "avisar:cancelar" }]);
  return { inline_keyboard: linhas };
}

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

// ===== /inadimplencia =====

type ParcelaComAluno = {
  valor: number;
  alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null;
};

async function inadimplencia(): Promise<string> {
  try {
    const admin = createAdminClient();
    // Coluna real é "data_vencimento" (não "vencimento") — ver 20260911100000_modulo_financeiro.sql.
    const { data } = await admin
      .from("parcelas")
      .select("valor, data_vencimento, alunos(telefone, profiles!alunos_id_fkey(full_name))")
      .eq("status", "atrasado")
      .order("data_vencimento", { ascending: true })
      .limit(50);

    const linhas = (data ?? []) as unknown as (ParcelaComAluno & { data_vencimento: string })[];
    if (linhas.length === 0) return "✅ Nenhuma parcela em atraso no momento.";

    type Agrupado = { nome: string; telefone: string | null; qtd: number; soma: number };
    const porAluno = new Map<string, Agrupado>();
    for (const p of linhas) {
      const nome = p.alunos?.profiles?.full_name ?? "aluno(a)";
      const telefone = p.alunos?.telefone ?? null;
      const chave = `${nome}|${telefone ?? ""}`;
      const atual = porAluno.get(chave) ?? { nome, telefone, qtd: 0, soma: 0 };
      atual.qtd += 1;
      atual.soma += Number(p.valor);
      porAluno.set(chave, atual);
    }

    const alunos = [...porAluno.values()].sort((a, b) => b.soma - a.soma);
    const somaGeral = alunos.reduce((s, a) => s + a.soma, 0);

    return [
      "💸 <b>Inadimplência</b>",
      `📅 ${dataExtenso()}`,
      "",
      `${alunos.length} aluno(s) com parcelas em atraso:`,
      "",
      ...alunos.flatMap((a) => [
        `- <b>${escapeHtml(a.nome)}</b> — ${a.qtd} parcela(s) — ${formatarBRL(a.soma)}`,
        `  📞 ${a.telefone ? escapeHtml(a.telefone) : "(sem telefone)"}`,
      ]),
      "",
      `Total em atraso: ${formatarBRL(somaGeral)}`,
      "",
      `🕐 ${horaBrasilia()} (Brasília)`,
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em inadimplencia", erro);
    return "⚠️ Não foi possível buscar a inadimplência. Tente novamente.";
  }
}

// ===== /vencendo =====

async function vencendoAmanha(): Promise<string> {
  try {
    const admin = createAdminClient();
    const amanha = amanhaISO();
    const { data } = await admin
      .from("parcelas")
      .select("valor, alunos(telefone, profiles!alunos_id_fkey(full_name))")
      .eq("status", "pendente")
      .eq("data_vencimento", amanha)
      .order("valor", { ascending: false });

    const linhas = (data ?? []) as unknown as ParcelaComAluno[];
    if (linhas.length === 0) return "✅ Nenhuma parcela vence amanhã.";

    const soma = linhas.reduce((s, p) => s + Number(p.valor), 0);

    return [
      "📋 <b>Vencendo Amanhã</b>",
      "",
      `${linhas.length} parcela(s) vencem amanhã (${formatarDataBR(amanha)}):`,
      "",
      ...linhas.flatMap((p) => [
        `- <b>${escapeHtml(p.alunos?.profiles?.full_name ?? "aluno(a)")}</b> — ${formatarBRL(Number(p.valor))}`,
        `  📞 ${p.alunos?.telefone ? escapeHtml(p.alunos.telefone) : "(sem telefone)"}`,
      ]),
      "",
      `Total: ${formatarBRL(soma)}`,
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em vencendoAmanha", erro);
    return "⚠️ Não foi possível buscar as parcelas de amanhã. Tente novamente.";
  }
}

// ===== /leads =====

// "leads" não tem coluna "convertido" (confirmado antes de implementar) — "sem contato" é
// status === "novo" (ainda não contatado), primeiro estágio do enum real de leads.status.
async function leadsSemContato(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("leads")
      .select("nome, telefone, created_at")
      .eq("status", "novo")
      .order("created_at", { ascending: true })
      .limit(15);

    const linhas = (data ?? []) as { nome: string; telefone: string; created_at: string }[];
    if (linhas.length === 0) return "✅ Nenhum lead pendente de contato.";

    const agora = Date.now();
    return [
      "🎯 <b>Leads sem Contato</b>",
      "",
      `${linhas.length} lead(s) aguardando contato:`,
      "",
      ...linhas.flatMap((l) => {
        const dias = Math.max(0, Math.floor((agora - new Date(l.created_at).getTime()) / 86_400_000));
        return [`- <b>${escapeHtml(l.nome)}</b> — ${dias} dia(s)`, `  📞 ${escapeHtml(l.telefone)}`];
      }),
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em leadsSemContato", erro);
    return "⚠️ Não foi possível buscar os leads. Tente novamente.";
  }
}

// ===== /resgates =====

async function resgatesPendentes(): Promise<string> {
  try {
    const admin = createAdminClient();
    // Só "premio_fisico": "curso_bonus" é liberado automaticamente, sem entrega física pra
    // rastrear — mesmo filtro usado pelo balão do dashboard admin (getNotificacaoResgatesPendentes,
    // src/lib/creditos/resgates.ts).
    const { data } = await admin
      .from("resgates")
      .select("item_nome, created_at, profiles!resgates_aluno_id_fkey(full_name)")
      .eq("status", "pendente")
      .eq("tipo", "premio_fisico")
      .order("created_at", { ascending: true })
      .limit(20);

    const linhas = (data ?? []) as unknown as {
      item_nome: string;
      created_at: string;
      profiles: { full_name: string | null } | null;
    }[];

    if (linhas.length === 0) return "✅ Nenhum resgate pendente.";

    return [
      "🏆 <b>Resgates Pendentes</b>",
      "",
      `${linhas.length} resgate(s) aguardando entrega:`,
      "",
      ...linhas.flatMap((r) => [
        `- <b>${escapeHtml(r.profiles?.full_name ?? "aluno(a)")}</b> — ${escapeHtml(r.item_nome)}`,
        `  📅 Solicitado em: ${formatarDataBR(r.created_at)}`,
      ]),
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em resgatesPendentes", erro);
    return "⚠️ Não foi possível buscar os resgates. Tente novamente.";
  }
}

// ===== /agenda =====

async function agendaHoje(): Promise<string> {
  try {
    const admin = createAdminClient();
    const hoje = hojeISO();
    // "agendamentos" não tem coluna "tipo"/"titulo" própria — o título pertence à página
    // (agendamento_paginas), referenciada por pagina_id.
    const { data } = await admin
      .from("agendamentos")
      .select("nome, whatsapp, horario, agendamento_paginas(titulo)")
      .eq("data_agendada", hoje)
      .eq("status", "confirmado")
      .order("horario", { ascending: true });

    const linhas = (data ?? []) as unknown as {
      nome: string;
      whatsapp: string;
      horario: string;
      agendamento_paginas: { titulo: string } | null;
    }[];

    if (linhas.length === 0) return "📅 Nenhum agendamento para hoje.";

    return [
      "📅 <b>Agenda de Hoje</b>",
      dataExtenso(),
      "",
      `${linhas.length} agendamento(s):`,
      "",
      ...linhas.flatMap((a) => [
        `- <b>${escapeHtml(a.nome)}</b> — ${escapeHtml(a.horario)}`,
        `  📋 ${escapeHtml(a.agendamento_paginas?.titulo ?? "—")}`,
        `  📞 ${escapeHtml(a.whatsapp)}`,
      ]),
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em agendaHoje", erro);
    return "⚠️ Não foi possível buscar a agenda de hoje. Tente novamente.";
  }
}

// ===== /frequencia =====

async function baixaFrequencia(): Promise<string> {
  try {
    const admin = createAdminClient();
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 28);
    const dataLimiteISO = dataLimite.toISOString().slice(0, 10);

    // "presencas" não tem aluno_id/presente boolean direto — é matricula_id + status (enum
    // presente|falta|justificada|reposicao), e o aluno só é alcançado via matriculas.alunos.
    const { data } = await admin
      .from("presencas")
      .select("matricula_id, status, matriculas(alunos(telefone, profiles!alunos_id_fkey(full_name)))")
      .gte("data", dataLimiteISO);

    const linhas = (data ?? []) as unknown as {
      matricula_id: string;
      status: string;
      matriculas: { alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null } | null;
    }[];

    type Agregado = { nome: string; telefone: string | null; presentes: number; total: number };
    const porMatricula = new Map<string, Agregado>();
    for (const p of linhas) {
      const nome = p.matriculas?.alunos?.profiles?.full_name ?? "aluno(a)";
      const telefone = p.matriculas?.alunos?.telefone ?? null;
      const atual = porMatricula.get(p.matricula_id) ?? { nome, telefone, presentes: 0, total: 0 };
      atual.total += 1;
      // "reposicao" conta como presença — mesmo critério de buscarDadosFrequenciaTurma
      // (src/lib/relatorios/frequencia-turma.ts).
      if (p.status === "presente" || p.status === "reposicao") atual.presentes += 1;
      porMatricula.set(p.matricula_id, atual);
    }

    const abaixoDe75 = [...porMatricula.values()]
      .map((a) => ({ ...a, percentual: a.total > 0 ? Math.round((a.presentes / a.total) * 100) : 0 }))
      .filter((a) => a.percentual < 75)
      .sort((a, b) => a.percentual - b.percentual)
      .slice(0, 15);

    if (abaixoDe75.length === 0) return "✅ Todos os alunos com frequência adequada.";

    return [
      "📊 <b>Baixa Frequência</b>",
      "(últimas 4 semanas)",
      "",
      `${abaixoDe75.length} aluno(s) abaixo de 75%:`,
      "",
      ...abaixoDe75.flatMap((a) => [
        `- <b>${escapeHtml(a.nome)}</b> — ${a.percentual}% (${a.presentes}/${a.total} aulas)`,
        `  📞 ${a.telefone ? escapeHtml(a.telefone) : "(sem telefone)"}`,
      ]),
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em baixaFrequencia", erro);
    return "⚠️ Não foi possível buscar a frequência. Tente novamente.";
  }
}

// ===== /estoque =====

async function estoqueBaixo(): Promise<string> {
  try {
    const admin = createAdminClient();
    // Coluna real é "quantidade_atual" (não "quantidade"/"estoque"), com limiar por item em
    // "quantidade_minima" — não um valor fixo (ver src/lib/estoque/schema.ts).
    const { data } = await admin.from("estoque_itens").select("nome, quantidade_atual, quantidade_minima, unidade");

    const linhas = ((data ?? []) as { nome: string; quantidade_atual: number; quantidade_minima: number; unidade: string }[])
      .filter((i) => i.quantidade_atual <= i.quantidade_minima)
      .sort((a, b) => a.quantidade_atual - b.quantidade_atual);

    if (linhas.length === 0) return "✅ Estoque normalizado.";

    return [
      "📦 <b>Estoque Baixo</b>",
      "",
      `${linhas.length} item(ns) com estoque crítico:`,
      "",
      ...linhas.map((i) => `- <b>${escapeHtml(i.nome)}</b> — ${i.quantidade_atual} ${escapeHtml(i.unidade)}`),
    ].join("\n");
  } catch (erro) {
    console.error("[telegram:webhook] erro em estoqueBaixo", erro);
    return "⚠️ Não foi possível buscar o estoque. Tente novamente.";
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

// ===== /avisar — busca de listas e envio da mensagem (compartilhado entre texto e botões) =====

async function buscarAlunosParaAvisar(admin: AdminClient): Promise<ItemLista[]> {
  const { data } = await admin
    .from("alunos")
    .select("id, telefone, profiles!alunos_id_fkey(full_name)")
    .not("telefone", "is", null)
    .limit(200);

  return (
    (data ?? []) as unknown as { id: string; telefone: string | null; profiles: { full_name: string | null } | null }[]
  )
    .map((a) => ({ id: a.id, nome: a.profiles?.full_name ?? "aluno(a)", telefone: a.telefone }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 30);
}

async function buscarTurmasParaAvisar(admin: AdminClient): Promise<ItemLista[]> {
  const { data } = await admin.from("turmas").select("id, nome").eq("status", "ativa").order("nome");
  return ((data ?? []) as { id: string; nome: string }[]).map((t) => ({ id: t.id, nome: t.nome, telefone: null }));
}

// Opção "3" do /avisar — todos os alunos com matrícula ativa, não um item de lista escolhido por
// índice (não passa por selecionarItemAvisar, que espera um ItemLista).
async function selecionarTodosAlunos(admin: AdminClient, chatId: number): Promise<void> {
  const { data: matriculasAtivas } = await admin.from("matriculas").select("alunos(telefone)").eq("status", "ativa");

  const telefones = [
    ...new Set(
      ((matriculasAtivas ?? []) as unknown as { alunos: { telefone: string | null } | null }[])
        .map((m) => m.alunos?.telefone)
        .filter((t): t is string => !!t),
    ),
  ];

  if (telefones.length === 0) {
    estadosAvisar.delete(chatId);
    await enviarMensagemTelegram("Nenhum aluno ativo com telefone cadastrado.", String(chatId));
    return;
  }

  await enviarMensagemTelegram(
    [
      "✅ <b>Destinatário:</b> Todos os alunos",
      `📞 ${telefones.length} número(s) encontrado(s)`,
      "",
      "⚠️ <b>Aviso:</b> Esta mensagem será enviada para TODOS os alunos ativos.",
      "",
      "✍️ Digite a mensagem a enviar via WhatsApp.",
      "(ou /cancelar para abortar)",
    ].join("\n"),
    String(chatId),
    { reply_markup: TECLADO_CANCELAR_AVISAR },
  );
  estadosAvisar.set(chatId, {
    etapa: "aguardando_mensagem",
    destinoTipo: null,
    lista: [],
    telefones,
    destinoNome: `Todos os alunos (${telefones.length})`,
  });
}

// Lista numerada em texto (sempre) + botões pros 8 primeiros (UX de um toque) — digitar o
// número de QUALQUER item da lista sempre funciona, botão ou não (fallback de compatibilidade).
async function enviarListaParaSelecao(
  chatId: number,
  lista: ItemLista[],
  prefixo: "aluno" | "turma",
  titulo: string,
  porLinha: 1 | 2,
): Promise<void> {
  const linhas = [
    titulo,
    ...lista.map((item, i) => `${i + 1}. ${escapeHtml(item.nome)}${item.telefone ? ` — ${item.telefone}` : ""}`),
  ];
  if (lista.length > MAX_BOTOES_LISTA) {
    linhas.push("", `Toque num botão (${MAX_BOTOES_LISTA} primeiros) ou digite o número de qualquer item da lista.`);
  }
  await enviarMensagemTelegram(linhas.join("\n"), String(chatId), { reply_markup: montarTecladoSelecao(lista, prefixo, porLinha) });
}

// Resolve o item escolhido (por texto digitado OU por botão clicado) pro destino final —
// mesma lógica nos dois caminhos, sem duplicar.
async function selecionarItemAvisar(admin: AdminClient, chatId: number, estado: EstadoAvisar, item: ItemLista): Promise<void> {
  if (estado.destinoTipo === "aluno") {
    if (!item.telefone) {
      estadosAvisar.delete(chatId);
      await enviarMensagemTelegram("Esse aluno não tem telefone cadastrado.", String(chatId));
      return;
    }
    await enviarMensagemTelegram(
      `✅ <b>Destinatário:</b> ${escapeHtml(item.nome)}\n📞 1 número encontrado\n\n✍️ Digite agora a mensagem a enviar via WhatsApp.\n(ou /cancelar para abortar)`,
      String(chatId),
      { reply_markup: TECLADO_CANCELAR_AVISAR },
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
    { reply_markup: TECLADO_CANCELAR_AVISAR },
  );
  estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_mensagem", telefones, destinoNome });
}

async function processarEstadoAvisar(chatId: number, texto: string): Promise<void> {
  const estado = estadosAvisar.get(chatId);
  if (!estado) return;
  const admin = createAdminClient();

  if (estado.etapa === "aguardando_destino") {
    if (texto === "1") {
      const lista = await buscarAlunosParaAvisar(admin);
      if (lista.length === 0) {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram("Nenhum aluno com telefone cadastrado encontrado.", String(chatId));
        return;
      }
      estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_selecao", destinoTipo: "aluno", lista });
      await enviarListaParaSelecao(chatId, lista, "aluno", "👤 <b>Selecione o aluno:</b>", 2);
      return;
    }

    if (texto === "2") {
      const lista = await buscarTurmasParaAvisar(admin);
      if (lista.length === 0) {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram("Nenhuma turma ativa encontrada.", String(chatId));
        return;
      }
      estadosAvisar.set(chatId, { ...estado, etapa: "aguardando_selecao", destinoTipo: "turma", lista });
      await enviarListaParaSelecao(chatId, lista, "turma", "🏫 <b>Selecione a turma:</b>", 1);
      return;
    }

    if (texto === "3") {
      await selecionarTodosAlunos(admin, chatId);
      return;
    }

    await enviarMensagemTelegram("Responda com 1 (aluno), 2 (turma) ou 3 (todos os alunos).", String(chatId));
    return;
  }

  if (estado.etapa === "aguardando_selecao") {
    const n = Number.parseInt(texto, 10);
    if (!Number.isInteger(n) || n < 1 || n > estado.lista.length) {
      await enviarMensagemTelegram("Número inválido. Tente novamente.", String(chatId));
      return;
    }
    await selecionarItemAvisar(admin, chatId, estado, estado.lista[n - 1]);
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
  const destinoNome = estado.destinoNome ?? "destinatário(s)";
  estadosAvisar.delete(chatId);

  if (enviadas === 0 && estado.telefones.length > 0) {
    await enviarMensagemTelegram(
      "⚠️ Nenhuma mensagem foi entregue. Verifique se o GênZap está conectado em Configurações → WhatsApp.",
      String(chatId),
      { reply_markup: REPLY_KEYBOARD },
    );
    return;
  }

  const preview = texto.length > 120 ? `${texto.slice(0, 120)}...` : texto;
  await enviarMensagemTelegram(
    `✅ Mensagem enviada para <b>${escapeHtml(destinoNome)}</b>!\n📨 ${enviadas} contato(s) notificado(s)\n\n📋 Mensagem enviada:\n<i>${escapeHtml(preview)}</i>`,
    String(chatId),
    { reply_markup: REPLY_KEYBOARD },
  );
}

// ===== callback_query (botões inline) =====
//
// avisar:aluno / avisar:turma -> escolha inicial de destino (equivalente a digitar "1"/"2").
// avisar:aluno:{i} / avisar:turma:{i} -> seleção de um item da lista pelo índice.
// avisar:cancelar -> aborta o fluxo. resumo:atualizar / alunos:atualizar -> recarrega a mensagem.
//
// Estado é inicializado aqui "se não existir" (defensivo — na prática /avisar já inicializa ao
// mostrar os botões, então isso só importa se o Map tiver perdido o estado entre o envio dos
// botões e o clique, ver limitação documentada no topo do arquivo).
async function processarCallback(chatId: number, data: string): Promise<void> {
  const admin = createAdminClient();

  if (data === "avisar:cancelar") {
    estadosAvisar.delete(chatId);
    await enviarMensagemTelegram(
      "❌ Operação cancelada.\n\nUse /avisar para começar novamente ou escolha uma opção abaixo:",
      String(chatId),
      { reply_markup: REPLY_KEYBOARD },
    );
    return;
  }

  if (data === "resumo:atualizar") {
    const msg = await resumoDoDia();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_RESUMO });
    return;
  }

  if (data === "alunos:atualizar") {
    const msg = await alunosAmanha();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_ALUNOS_AMANHA });
    return;
  }

  if (data === "inadimplencia:atualizar") {
    const msg = await inadimplencia();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_INADIMPLENCIA });
    return;
  }

  if (data === "vencendo:atualizar") {
    const msg = await vencendoAmanha();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_VENCENDO });
    return;
  }

  if (data === "leads:atualizar") {
    const msg = await leadsSemContato();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_LEADS });
    return;
  }

  if (data === "resgates:atualizar") {
    const msg = await resgatesPendentes();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_RESGATES });
    return;
  }

  if (data === "agenda:atualizar") {
    const msg = await agendaHoje();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_AGENDA });
    return;
  }

  if (data === "frequencia:atualizar") {
    const msg = await baixaFrequencia();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_FREQUENCIA });
    return;
  }

  if (data === "estoque:atualizar") {
    const msg = await estoqueBaixo();
    await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_ESTOQUE });
    return;
  }

  if (data === "avisar:todos") {
    await selecionarTodosAlunos(admin, chatId);
    return;
  }

  if (data === "avisar:aluno" || data === "avisar:turma") {
    const destinoTipo = data === "avisar:aluno" ? "aluno" : "turma";
    const base = estadosAvisar.get(chatId) ?? { etapa: "aguardando_destino" as const, destinoTipo: null, lista: [], telefones: [], destinoNome: null };
    const lista = destinoTipo === "aluno" ? await buscarAlunosParaAvisar(admin) : await buscarTurmasParaAvisar(admin);

    if (lista.length === 0) {
      estadosAvisar.delete(chatId);
      await enviarMensagemTelegram(
        destinoTipo === "aluno" ? "Nenhum aluno com telefone cadastrado encontrado." : "Nenhuma turma ativa encontrada.",
        String(chatId),
      );
      return;
    }

    estadosAvisar.set(chatId, { ...base, etapa: "aguardando_selecao", destinoTipo, lista });
    await enviarListaParaSelecao(
      chatId,
      lista,
      destinoTipo,
      destinoTipo === "aluno" ? "👤 <b>Selecione o aluno:</b>" : "🏫 <b>Selecione a turma:</b>",
      destinoTipo === "aluno" ? 2 : 1,
    );
    return;
  }

  const matchSelecao = /^avisar:(aluno|turma):(\d+)$/.exec(data);
  if (matchSelecao) {
    const destinoTipo = matchSelecao[1] as "aluno" | "turma";
    const indice = Number(matchSelecao[2]);
    const estado = estadosAvisar.get(chatId);
    if (!estado || estado.destinoTipo !== destinoTipo || !estado.lista[indice]) {
      await enviarMensagemTelegram("Essa seleção expirou. Use /avisar de novo.", String(chatId));
      return;
    }
    await selecionarItemAvisar(admin, chatId, estado, estado.lista[indice]);
  }
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

  // callback_query (botão inline clicado) tem prioridade sobre mensagem de texto — um update só
  // traz um ou outro, nunca os dois. responderCallbackQuery SEMPRE roda primeiro e incondicional
  // (mesmo se faltar data/chat), senão o botão fica "carregando" pra sempre no app do usuário —
  // mais robusto que só responder dentro do "if data && chat", que deixaria passar batido
  // qualquer callback_query malformado.
  const callbackQuery = update?.callback_query;
  if (callbackQuery) {
    await responderCallbackQuery(callbackQuery.id).catch(() => false);
    const cbChatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
    const cbData = callbackQuery.data;
    if (cbChatId && !ALLOWED_CHAT_IDS.has(cbChatId)) {
      return new Response("OK", { status: 200 });
    }
    if (cbChatId && cbData) {
      try {
        await processarCallback(cbChatId, cbData);
      } catch (err) {
        console.error("[telegram:webhook] erro ao processar callback_query:", err);
      }
    }
    return new Response("OK", { status: 200 });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const texto = message?.text?.trim();

  if (chatId && !ALLOWED_CHAT_IDS.has(chatId)) {
    return new Response("OK", { status: 200 });
  }

  try {
    // Estado ativo de /avisar tem prioridade sobre o switch de comandos — qualquer texto do
    // usuário nessa janela é resposta ao passo atual do fluxo, não um comando novo.
    if (chatId && texto && estadosAvisar.has(chatId)) {
      if (texto.toLowerCase() === "/cancelar") {
        estadosAvisar.delete(chatId);
        await enviarMensagemTelegram(
          "❌ Operação cancelada.\n\nUse /avisar para começar novamente ou escolha uma opção abaixo:",
          String(chatId),
          { reply_markup: REPLY_KEYBOARD },
        );
      } else {
        await processarEstadoAvisar(chatId, texto);
      }
      return new Response("OK", { status: 200 });
    }

    if (!chatId || !texto) return new Response("OK", { status: 200 });

    // Normaliza comando — grupos enviam "/cmd@nomedobot".
    const cmd = texto.split("@")[0].toLowerCase();
    // Clique num botão do teclado fixo chega como texto puro (não começa com "/") — traduz
    // de volta pro comando antes de exigir o prefixo "/".
    const cmdFinal = MAP_BOTAO[texto.toLowerCase()] ?? cmd;
    if (!cmdFinal.startsWith("/")) return new Response("OK", { status: 200 });

    const username = message?.from?.username ?? message?.from?.first_name ?? "usuário";
    console.log(`[telegram:webhook] comando "${cmdFinal}" de ${username} (chat ${chatId})`);

    switch (cmdFinal) {
      case "/start":
      case "/ajuda":
        await enviarMensagemTelegram(MENSAGEM_AJUDA, String(chatId), { reply_markup: REPLY_KEYBOARD });
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
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_RESUMO });
        break;
      }
      case "/alunos_amanha": {
        const msg = await alunosAmanha();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_ALUNOS_AMANHA });
        break;
      }
      case "/avisar":
        // Estado é inicializado JÁ AQUI (não só no clique do botão): o fluxo de texto (digitar
        // "1"/"2") precisa continuar funcionando em paralelo aos botões — se só inicializasse no
        // callback, quem digitasse "1" sem clicar em nada não teria estado algum ativo.
        estadosAvisar.set(chatId, { etapa: "aguardando_destino", destinoTipo: null, lista: [], telefones: [], destinoNome: null });
        await enviarMensagemTelegram(
          "📣 <b>Avisar — Para quem deseja enviar?</b>\n\n(ou digite 1 para aluno / 2 para turma / 3 para todos)",
          String(chatId),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "👤 Aluno específico", callback_data: "avisar:aluno" },
                  { text: "🏫 Turma inteira", callback_data: "avisar:turma" },
                ],
                [{ text: "📢 Todos os alunos", callback_data: "avisar:todos" }],
                [{ text: "❌ Cancelar", callback_data: "avisar:cancelar" }],
              ],
            },
          },
        );
        break;
      case "/menu":
        await enviarMensagemTelegram("📋 <b>Menu — Gênezi</b>\n\nEscolha uma opção abaixo:", String(chatId), { reply_markup: REPLY_KEYBOARD });
        break;
      case "/cancelar":
        // Só chega aqui quando NÃO há estado de /avisar ativo — o bloco acima (estadosAvisar.has)
        // já intercepta e trata "/cancelar" antes do switch sempre que há algo em andamento.
        await enviarMensagemTelegram("Nenhuma ação em andamento.", String(chatId));
        break;
      case "/inadimplencia": {
        const msg = await inadimplencia();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_INADIMPLENCIA });
        break;
      }
      case "/vencendo": {
        const msg = await vencendoAmanha();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_VENCENDO });
        break;
      }
      case "/leads": {
        const msg = await leadsSemContato();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_LEADS });
        break;
      }
      case "/resgates": {
        const msg = await resgatesPendentes();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_RESGATES });
        break;
      }
      case "/agenda": {
        const msg = await agendaHoje();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_AGENDA });
        break;
      }
      case "/frequencia": {
        const msg = await baixaFrequencia();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_FREQUENCIA });
        break;
      }
      case "/estoque": {
        const msg = await estoqueBaixo();
        await enviarMensagemTelegram(msg, String(chatId), { reply_markup: TECLADO_ESTOQUE });
        break;
      }
      default:
        await enviarMensagemTelegram("Comando não reconhecido. Use /ajuda para ver os disponíveis.", String(chatId));
    }
  } catch (err) {
    console.error("[telegram:webhook] erro ao processar update:", err);
  }

  return new Response("OK", { status: 200 });
}
