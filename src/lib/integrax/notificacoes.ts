import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarSMS } from "@/lib/integrax/sms";
import { montarMensagemSms } from "@/lib/integrax/modelos";

// SMS automáticos do sistema pela IntegraX. Cada função agenda o envio pra DEPOIS da resposta
// (after) e engole qualquer erro — nunca atrasa nem quebra o fluxo que chamou.
//
// O TEXTO de cada SMS vem do template do evento (Configurações > Apps > IntegraX > Templates,
// tabela sms_templates) com os {placeholders} substituídos; se o template estiver inativo ou a
// tabela indisponível, vale a mensagem padrão que sempre esteve no código (src/lib/integrax/
// templates.ts) — ver montarMensagemSms.
//
// Enquanto a integração não estiver configurada e ativa em /admin/configuracoes/apps/integrax,
// enviarSMS() só registra no console o que SERIA enviado (destino, tamanho e texto) — é o "stub".

type Aluno = { full_name: string | null; email: string | null; telefone: string | null } | null;

function emSegundoPlano(tarefa: () => Promise<void>): void {
  const executar = async () => {
    try {
      await tarefa();
    } catch (erro) {
      console.error("[integrax] falha ao preparar SMS", erro);
    }
  };
  try {
    after(executar);
  } catch {
    void executar();
  }
}

export function primeiroNomeSms(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "aluno(a)";
}

function reais(valor: number): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

function dataBR(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// ----- Matrícula criada: boas-vindas com os dados de acesso (template "acesso") -----

type LinhaMatricula = {
  alunos: Aluno;
  turmas: { cursos: { nome: string } | null } | null;
};

export function notificarSmsMatriculaCriada(matriculaId: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("matriculas")
      .select("alunos(full_name, email, telefone), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .maybeSingle();
    const matricula = data as unknown as LinhaMatricula | null;
    const aluno = matricula?.alunos;
    if (!aluno?.telefone) return;

    // A senha não é conhecida aqui (a conta do aluno já existia); o SMS traz o
    // login (e-mail) — a senha continua sendo entregue pelo fluxo de acesso.
    const mensagem = await montarMensagemSms("acesso", {
      nome_aluno: primeiroNomeSms(aluno.full_name),
      nome_curso: matricula?.turmas?.cursos?.nome ?? "seu curso",
      email: aluno.email ?? "cadastrado",
    });
    await enviarSMS(aluno.telefone, mensagem);
  });
}

// ----- Parcela: pagamento recebido / cobrança gerada / PIX gerado -----

type LinhaParcela = {
  valor: number;
  numero_parcela: number;
  data_vencimento: string | null;
  alunos: Aluno;
  matriculas: { num_parcelas: number | null; turmas: { cursos: { nome: string } | null } | null } | null;
};

async function carregarParcela(parcelaId: string): Promise<LinhaParcela | null> {
  const { data } = await createAdminClient()
    .from("parcelas")
    .select(
      "valor, numero_parcela, data_vencimento, alunos(full_name, email, telefone), matriculas(num_parcelas, turmas(cursos(nome)))",
    )
    .eq("id", parcelaId)
    .maybeSingle();
  return data as unknown as LinhaParcela | null;
}

function rotuloParcela(parcela: LinhaParcela): string {
  const total = parcela.matriculas?.num_parcelas;
  return total && total > 1 ? `${parcela.numero_parcela}/${total}` : String(parcela.numero_parcela);
}

function valoresDeParcela(parcela: LinhaParcela, aluno: NonNullable<Aluno>): Record<string, string> {
  return {
    nome_aluno: primeiroNomeSms(aluno.full_name),
    parcela: rotuloParcela(parcela),
    valor: reais(parcela.valor),
    vencimento: dataBR(parcela.data_vencimento),
    nome_curso: parcela.matriculas?.turmas?.cursos?.nome ?? "",
  };
}

export function notificarSmsPagamentoRecebido(parcelaId: string): void {
  emSegundoPlano(async () => {
    const parcela = await carregarParcela(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const valores = valoresDeParcela(parcela, aluno);
    // Texto antigo: "... de {curso}" — sem curso cai em "seu curso" só nas mensagens que o usavam.
    const mensagem = await montarMensagemSms("pagamento_confirmado", { ...valores, nome_curso: valores.nome_curso || "seu curso" });
    await enviarSMS(aluno.telefone, mensagem);
  });
}

export function notificarSmsCobrancaGerada(parcelaId: string): void {
  emSegundoPlano(async () => {
    const parcela = await carregarParcela(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const mensagem = await montarMensagemSms("cobranca", valoresDeParcela(parcela, aluno));
    await enviarSMS(aluno.telefone, mensagem);
  });
}

// Template "pix_gerado": pronto para uso, mas HOJE nada o dispara — o sistema não tem um evento
// de PIX separado (a cobrança sai como fatura do gateway e já dispara "cobranca"). Quando esse
// evento existir, é só chamar esta função no ponto certo.
export function notificarSmsPixGerado(parcelaId: string): void {
  emSegundoPlano(async () => {
    const parcela = await carregarParcela(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const mensagem = await montarMensagemSms("pix_gerado", valoresDeParcela(parcela, aluno));
    await enviarSMS(aluno.telefone, mensagem);
  });
}

// ----- Lead: confirmação de interesse (template "lead_confirmacao") -----

export function notificarSmsLeadConfirmacao(leadId: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("leads")
      .select("nome, telefone, cursos(nome)")
      .eq("id", leadId)
      .maybeSingle();
    const lead = data as unknown as { nome: string; telefone: string; cursos: { nome: string } | null } | null;
    if (!lead?.telefone) return;

    const mensagem = await montarMensagemSms("lead_confirmacao", {
      nome_cliente: primeiroNomeSms(lead.nome),
      curso_interesse: lead.cursos?.nome ?? "nossos cursos",
    });
    await enviarSMS(lead.telefone, mensagem);
  });
}

// ----- Agendamento: lembrete D-1 (template "agendamento_lembrete") -----

export function notificarSmsAgendamentoLembrete(agendamentoId: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("agendamentos")
      .select("nome, whatsapp, data_agendada, horario")
      .eq("id", agendamentoId)
      .maybeSingle();
    const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string } | null;
    if (!agendamento?.whatsapp) return;

    const mensagem = await montarMensagemSms("agendamento_lembrete", {
      nome_cliente: primeiroNomeSms(agendamento.nome),
      data: dataBR(agendamento.data_agendada),
      hora: agendamento.horario,
    });
    await enviarSMS(agendamento.whatsapp, mensagem);
  });
}
