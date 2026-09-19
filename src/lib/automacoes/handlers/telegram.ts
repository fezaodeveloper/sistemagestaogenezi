import "server-only";

import { enviarAlertaTelegram } from "@/lib/telegram/client";
import { enviarPushAdmin } from "@/lib/push/enviar";
import { dataComDiaSemana } from "@/lib/datas/util";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

const LINK_FINANCEIRO = "https://sistemagestaogenezi.vercel.app/admin/financeiro";
const LINK_LEADS = "https://sistemagestaogenezi.vercel.app/admin/leads";
const LINK_ALUNOS = "https://sistemagestaogenezi.vercel.app/admin/alunos";
const LINK_CONTRATOS = "https://sistemagestaogenezi.vercel.app/admin/contratos";
const LINK_RESGATES = "https://sistemagestaogenezi.vercel.app/admin/resgates";
const LINK_MATRICULAS = "https://sistemagestaogenezi.vercel.app/admin/matriculas";

function formatarReais(valor: unknown): string {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(data: unknown): string {
  if (typeof data !== "string" || data.length < 10) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function texto(valor: unknown): string {
  return typeof valor === "string" && valor.length > 0 ? valor : "—";
}

export async function notificarPagamentoRecebido(payload: Record<string, unknown>): Promise<boolean> {
  const resultado = await enviarAlertaTelegram(
    "Pagamento Recebido",
    [
      `💰 Valor: R$ ${formatarReais(payload.valor)}`,
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
      `📋 Parcela: ${texto(payload.numero_parcela)}/${texto(payload.total_parcelas)}`,
    ],
    "🟢",
  );
  await enviarPushAdmin(
    "Pagamento Recebido",
    `${texto(payload.nome_aluno)} — R$ ${formatarReais(payload.valor)}`,
    LINK_FINANCEIRO,
  );
  return resultado;
}

export async function notificarPagamentoAtrasado(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Pagamento em Atraso",
    [
      `💸 Valor: R$ ${formatarReais(payload.valor)}`,
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📅 Vencimento: ${formatarData(payload.data_vencimento)}`,
      `🔗 Ver financeiro: ${LINK_FINANCEIRO}`,
    ],
    "🔴",
  );
}

export async function notificarMatriculaCriada(payload: Record<string, unknown>): Promise<boolean> {
  const resultado = await enviarAlertaTelegram(
    "Nova Matrícula",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
      `🏫 Turma: ${texto(payload.nome_turma)}`,
      `💰 Valor: R$ ${formatarReais(payload.valor_final)}`,
    ],
    "🎓",
  );
  await enviarPushAdmin(
    "Nova Matrícula",
    `${texto(payload.nome_aluno)} — ${texto(payload.nome_curso)}`,
    LINK_MATRICULAS,
  );
  return resultado;
}

export async function notificarCertificadoEmitido(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Certificado Emitido",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
      `✅ Frequência: ${texto(payload.frequencia)}% | Nota: ${texto(payload.nota)}`,
    ],
    "🏆",
  );
}

export async function notificarLeadNovo(payload: Record<string, unknown>): Promise<boolean> {
  const resultado = await enviarAlertaTelegram(
    "Novo Lead",
    [
      `👤 Nome: ${texto(payload.nome)}`,
      `📞 Telefone: ${texto(payload.telefone)}`,
      `📚 Interesse: ${texto(payload.curso)}`,
      `🔗 Ver CRM: ${LINK_LEADS}`,
    ],
    "🎯",
  );
  await enviarPushAdmin(
    "Novo Lead",
    `${texto(payload.nome)} — ${texto(payload.telefone)}`,
    LINK_LEADS,
  );
  return resultado;
}

export async function notificarAlunoLogin(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Login de Aluno",
    [`👋 ${texto(payload.nome_aluno)} acabou de entrar na plataforma`],
    "👋",
  );
}

export async function notificarAulaConcluida(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Aula Concluída",
    [
      `👤 ${texto(payload.nome_aluno)}`,
      `📖 Aula: ${texto(payload.nome_aula)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
    ],
    "✅",
  );
}

export async function notificarCursoConcluido(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Curso Concluído!",
    [
      `👤 ${texto(payload.nome_aluno)} concluiu ${texto(payload.nome_curso)}`,
      `📊 Frequência: ${texto(payload.frequencia)}% | Nota: ${texto(payload.nota)}`,
    ],
    "🎉",
  );
}

export async function notificarEvasaoRisco(payload: Record<string, unknown>): Promise<boolean> {
  const motivos = Array.isArray(payload.motivos) ? payload.motivos.join(", ") : texto(payload.motivos);
  const resultado = await enviarAlertaTelegram(
    "RISCO DE EVASÃO",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
      `📊 Índice de risco: ${texto(payload.indice)}/100`,
      `Motivos: ${motivos}`,
      `🔗 Ver aluno: ${LINK_ALUNOS}`,
    ],
    "⚠️",
  );
  await enviarPushAdmin(
    "Risco de Evasão",
    `${texto(payload.nome_aluno)} — índice ${texto(payload.indice)}/100`,
    LINK_ALUNOS,
  );
  return resultado;
}

export async function notificarPremioEstoqueBaixo(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Estoque Baixo",
    [
      `🎁 Prêmio: ${texto(payload.nome)}`,
      `📦 Estoque atual: ${texto(payload.estoque)} unidade(s)`,
      `⚙️ Mínimo configurado: ${texto(payload.estoque_minimo)}`,
    ],
    "🎁",
  );
}

export async function notificarBaixaFrequencia(payload: Record<string, unknown>): Promise<boolean> {
  const alunosAbaixo = Array.isArray(payload.alunos_abaixo) ? payload.alunos_abaixo : [];
  const linhasAlunos = alunosAbaixo.map((item) => {
    const aluno = item as { nome: string; percentual: number };
    return `- ${aluno.nome}: ${aluno.percentual}%`;
  });
  return enviarAlertaTelegram(
    "Baixa Frequência",
    [
      `🏫 Turma: ${texto(payload.turma_nome)}`,
      `📊 Média da turma: ${texto(payload.percentual)}%`,
      `👥 Alunos abaixo de 75%:`,
      ...linhasAlunos,
    ],
    "⚠️",
  );
}

export async function notificarErroSistema(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Erro no Sistema",
    [`📍 Local: ${texto(payload.local)}`, `❌ Erro: ${texto(payload.mensagem)}`],
    "🚨",
  );
}

export async function notificarContratoAssinado(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Contrato Assinado",
    [
      `📝 ${texto(payload.nome_aluno)} assinou o contrato digitalmente`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
    ],
    "✅",
  );
}

export async function notificarContratoPendente(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Contrato Pendente",
    [
      `📝 ${texto(payload.nome_aluno)} ainda não assinou o contrato`,
      `📅 Pendente há ${texto(payload.dias)} dias`,
      `🔗 Ver contratos: ${LINK_CONTRATOS}`,
    ],
    "⏳",
  );
}

export async function notificarLeadSemContato(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Lead sem contato",
    [
      `👤 ${texto(payload.nome)} aguarda contato há ${texto(payload.dias)} dias`,
      `📞 Telefone: ${texto(payload.telefone)}`,
      `🔗 Ver CRM: ${LINK_LEADS}`,
    ],
    "🎯",
  );
}

export async function notificarParcelaVencendoAmanha(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Parcela vencendo amanhã",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `💰 Valor: R$ ${formatarReais(payload.valor)}`,
      `📅 Vencimento: ${formatarData(payload.data_vencimento)}`,
    ],
    "⚠️",
  );
}

export async function notificarNovoResgate(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Novo Resgate de Prêmio",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `🏆 Prêmio: ${texto(payload.nome_premio)}`,
      `💎 Créditos usados: ${texto(payload.creditos)}`,
      `🔗 Ver resgates: ${LINK_RESGATES}`,
    ],
    "🎁",
  );
}

export async function notificarInteresseCurso(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Interesse em Curso!",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📞 Telefone: ${texto(payload.telefone)}`,
      `📚 Curso de interesse: ${texto(payload.nome_curso)}`,
      `🔗 Ver aluno: ${LINK_ALUNOS}`,
    ],
    "🎯",
  );
}

export async function notificarSenhaTrocadaAluno(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Senha Redefinida",
    [`👤 Aluno: ${texto(payload.nome_aluno)}`, `👨‍💼 Redefinida pelo admin`],
    "🔐",
  );
}

export async function notificarTermoAceito(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Termo Aceito",
    [`👤 Aluno: ${texto(payload.nome_aluno)}`, `📄 Termo: ${texto(payload.nome_termo)}`],
    "📋",
  );
}

export async function notificarEmpresaCadastro(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "CONECTA — Nova Empresa",
    [
      `🏢 Empresa: ${texto(payload.nome_empresa)}`,
      `👤 Responsável: ${texto(payload.nome_responsavel)}`,
      `📞 WhatsApp: ${texto(payload.whatsapp)}`,
      `🏙️ Cidade: ${texto(payload.cidade)}/${texto(payload.estado)}`,
      `⏳ Aguardando aprovação`,
    ],
    "🏢",
  );
}

export async function notificarConectaPagamentoConfirmado(
  payload: Record<string, unknown>,
): Promise<boolean> {
  return enviarAlertaTelegram(
    "GÊNEZI CONECTA — Pagamento Confirmado",
    [
      `👤 Candidato: ${texto(payload.nome)}`,
      `📋 Plano: ${texto(payload.plano)}`,
      `✅ Perfil ativado automaticamente`,
    ],
    "💳",
  );
}

export async function notificarNovaVagaConecta(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "GÊNEZI CONECTA — Nova Vaga",
    [
      `🏢 Empresa: ${texto(payload.nome_empresa)}`,
      `💼 Vaga: ${texto(payload.titulo)}`,
      `📍 Local: ${texto(payload.cidade)}/${texto(payload.estado)}`,
      `🔗 Modalidade: ${texto(payload.modalidade)}`,
    ],
    "💼",
  );
}

export async function notificarConectaAssinaturaCancelada(
  payload: Record<string, unknown>,
): Promise<boolean> {
  return enviarAlertaTelegram(
    "GÊNEZI CONECTA — Assinatura Cancelada",
    [
      `👤 Candidato: ${texto(payload.nome)}`,
      `📋 Plano: ${texto(payload.plano)}`,
      `🔒 Perfil ocultado automaticamente`,
    ],
    "❌",
  );
}

export async function notificarMensagemEnviadaParaEmpresa(
  payload: Record<string, unknown>,
): Promise<boolean> {
  return enviarAlertaTelegram(
    "CONECTA — Mensagem Enviada",
    [
      `🏢 Empresa: ${texto(payload.nome_empresa)}`,
      `📋 Título: ${texto(payload.titulo)}`,
      `💬 Mensagem: ${texto(payload.mensagem)}`,
      `👨‍💼 Enviado por: admin`,
    ],
    "📨",
  );
}

export async function notificarResumoMensal(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Resumo Mensal",
    [
      `📅 ${texto(payload.mes)}/${texto(payload.ano)}`,
      `💰 Receita total: R$ ${formatarReais(payload.receita)}`,
      `📉 Inadimplência: ${texto(payload.parcelas_atrasadas)} parcelas (R$ ${formatarReais(payload.valor_atrasado)})`,
      `🎓 Novas matrículas: ${texto(payload.novas_matriculas)}`,
      `🏆 Certificados emitidos: ${texto(payload.certificados_emitidos)}`,
      `🎯 Leads captados: ${texto(payload.leads_captados)}`,
      `📊 Saúde da escola: ${texto(payload.pontuacao)}/100`,
    ],
    "📊",
  );
}

// Resumo diário do cron de follow-up automático de leads (roadmap, item 3)
// — ver src/app/api/cron/followup-leads/route.ts.
export async function notificarFollowupLeadsResumo(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Follow-up diário de Leads",
    [
      `📞 ${texto(payload.contatados)} lead(s) contatados automaticamente`,
      `⚠️ ${texto(payload.aguardamAcaoManual)} lead(s) passaram a aguardar ação manual (7 dias sem resposta)`,
      `🔗 Ver CRM: ${LINK_LEADS}`,
    ],
    "📊",
  );
}

// ===== Sistema de agendamentos (roadmap, item 2) =====

export async function notificarAgendamentoCriado(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Novo Agendamento",
    [
      `👤 ${texto(payload.nome)}`,
      `📱 WhatsApp: ${texto(payload.whatsapp)}`,
      // Dia da semana por extenso antes da data: "Quarta-feira, 25/09/2026".
      `📅 ${dataComDiaSemana(payload.data_agendada)} às ${texto(payload.horario)}`,
      `📋 Página: ${texto(payload.titulo_pagina)}`,
    ],
    "📅",
  );
}

export async function notificarLembretesAgendamentosResumo(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Lembretes D-1 de Agendamentos",
    [`📅 ${texto(payload.quantidade)} agendamento(s) para amanhã`],
    "📅",
  );
}

// ===== Aviso de presença (cron aviso-presenca) =====

const LINK_TURMAS = "https://sistemagestaogenezi.vercel.app/admin/turmas";

// Uma hora depois do início da aula, avisa que a presença ainda precisa ser
// marcada. Lança se o Telegram recusar a mensagem — o motor registra o evento
// como falho no log de automações (senão a falha ficaria invisível).
export async function notificarAvisoPresenca(payload: Record<string, unknown>): Promise<boolean> {
  const mensagem = [
    "⚠️ <b>Marcar presença:</b>",
    `📚 Turma: ${escapeHtml(texto(payload.turma_nome))}`,
    `🕐 Aula iniciou às: ${escapeHtml(texto(payload.horario_inicio))}`,
    `👥 Alunos: ${escapeHtml(payload.alunos_ativos ?? "—")}`,
    `🔗 Acesse: ${LINK_TURMAS}/${escapeHtml(texto(payload.turma_id))}`,
  ].join("\n");

  const enviada = await sendTelegram(mensagem);
  if (!enviada) throw new Error("O Telegram não aceitou a mensagem de aviso de presença.");
  return true;
}

// ===== Construtor de páginas de campanha (roadmap, item 1) =====

export async function notificarCampanhaResposta(payload: Record<string, unknown>): Promise<boolean> {
  return enviarAlertaTelegram(
    "Nova inscrição em campanha",
    [
      `📄 Campanha: ${texto(payload.titulo_pagina)}`,
      `👤 Nome: ${texto(payload.nome)}`,
      `📞 WhatsApp: ${texto(payload.whatsapp)}`,
      `🏙️ Cidade: ${texto(payload.cidade)}`,
    ],
    "📋",
  );
}
