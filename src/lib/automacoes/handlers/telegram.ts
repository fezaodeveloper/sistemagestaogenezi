import "server-only";

import { enviarAlertaTelegram } from "@/lib/telegram/client";

const LINK_FINANCEIRO = "https://sistemagestaogenezi.vercel.app/admin/financeiro";
const LINK_LEADS = "https://sistemagestaogenezi.vercel.app/admin/leads";
const LINK_ALUNOS = "https://sistemagestaogenezi.vercel.app/admin/alunos";
const LINK_CONTRATOS = "https://sistemagestaogenezi.vercel.app/admin/contratos";
const LINK_RESGATES = "https://sistemagestaogenezi.vercel.app/admin/resgates";

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
  return enviarAlertaTelegram(
    "Pagamento Recebido",
    [
      `💰 Valor: R$ ${formatarReais(payload.valor)}`,
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
      `📋 Parcela: ${texto(payload.numero_parcela)}/${texto(payload.total_parcelas)}`,
    ],
    "🟢",
  );
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
  return enviarAlertaTelegram(
    "Nova Matrícula",
    [
      `👤 Aluno: ${texto(payload.nome_aluno)}`,
      `📚 Curso: ${texto(payload.nome_curso)}`,
      `🏫 Turma: ${texto(payload.nome_turma)}`,
      `💰 Valor: R$ ${formatarReais(payload.valor_final)}`,
    ],
    "🎓",
  );
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
  return enviarAlertaTelegram(
    "Novo Lead",
    [
      `👤 Nome: ${texto(payload.nome)}`,
      `📞 Telefone: ${texto(payload.telefone)}`,
      `📚 Interesse: ${texto(payload.curso)}`,
      `🔗 Ver CRM: ${LINK_LEADS}`,
    ],
    "🎯",
  );
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
  return enviarAlertaTelegram(
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
