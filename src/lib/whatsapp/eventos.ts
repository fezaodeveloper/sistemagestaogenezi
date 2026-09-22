import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import { renderTemplate } from "@/lib/whatsapp/render";
import { dispararFluxosPorGatilho } from "@/lib/whatsapp/fluxos";
// Reaproveitado de propósito (apesar do nome): só busca configuracoes.escola_nome, não tem nada
// de específico de SMS — evita duplicar essa mesma busca aqui.
import { nomeEscolaParaSms } from "@/lib/integrax/modelos";
import { DIA_SEMANA_LABELS } from "@/lib/agendamentos/schema";

// Eventos do sistema que disparam WhatsApp via GênZap. Cada função agenda o envio pra DEPOIS da
// resposta (after) e engole qualquer erro — nunca atrasa nem quebra o fluxo que chamou (mesmo
// padrão de src/lib/integrax/notificacoes.ts). Com o GênZap desligado/desconectado,
// enviarWhatsApp() só registra no console o que SERIA enviado.
//
// FORA DESTE ARQUIVO DE PROPÓSITO — matrícula criada, lembrete de aula e falta em aula: já são
// reais desde a Fase 13 (src/lib/mensagens/mensagens.ts: enviarMensagemMatriculaCriada/
// LembreteAula/Falta), com log em `mensagens_enviadas`, retry e editor próprio. A Fase 2 migrou
// o TEXTO desses 3 templates (+ recontato_lead) pra whatsapp_templates (ver a migration) e
// mensagens.ts passou a ler de lá (ver renderTemplate ali) — mas o CAMINHO de envio continua
// sendo o mesmo já testado, para não duplicar nem arriscar quebrar 4 eventos que já funcionam.
//
// GênZap Fase 3 — fluxos personalizados (src/lib/whatsapp/fluxos.ts): dispararFluxosPorGatilho()
// é chamada APÓS o envio automático de cada evento que tem um gatilho de fluxo correspondente.
// Os 6 gatilhos de fluxo (matricula_criada, agendamento_criado, lead_criado, pagamento_recebido,
// cobranca_atrasada, manual) são um vocabulário MENOR e não coincidem 1:1 com os 13 templates —
// só "cobranca_atrasada" tem uma função só dela aqui embaixo; os outros 4 automáticos
// (matrícula criada, agendamento criado, lead criado, pagamento recebido) já disparam WhatsApp
// em pontos FORA deste arquivo (lib/mensagens/mensagens.ts, lib/leads/leads.ts,
// lib/gateways/parcelas.ts, webhooks/asaas, agendar/[slug]/actions.ts) — a chamada de
// dispararFluxosPorGatilho pra esses 4 fica lá, no ponto real do evento, pelo mesmo motivo.

function emSegundoPlano(tarefa: () => Promise<void>): void {
  const executar = async () => {
    try {
      await tarefa();
    } catch (erro) {
      console.error("[whatsapp] falha ao preparar mensagem", erro);
    }
  };
  try {
    after(executar);
  } catch {
    void executar();
  }
}

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "";
}

function dataBR(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function reais(valor: number): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

// getDay() na string "aaaa-mm-dd" pura (sem hora) usaria o fuso do processo — força meio-dia UTC
// pra nunca virar o dia anterior/seguinte por causa de fuso horário.
function diaDaSemana(dataISO: string): string {
  const dia = new Date(`${dataISO.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return DIA_SEMANA_LABELS[dia]?.toLowerCase() ?? "";
}

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

function urlPortal(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

// ----- Agendamento: lembrete D-1 (cron lembrete-agendamentos) -----

export function notificarWhatsappAgendamentoLembrete(agendamentoId: string): Promise<void> {
  return (async () => {
    try {
      const { data } = await createAdminClient()
        .from("agendamentos")
        .select("nome, whatsapp, data_agendada, horario")
        .eq("id", agendamentoId)
        .maybeSingle();
      const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string } | null;
      if (!agendamento?.whatsapp) return;

      const mensagem = await renderTemplate("agendamento_lembrete", {
        nome: primeiroNome(agendamento.nome) || agendamento.nome,
        data: dataBR(agendamento.data_agendada),
        horario: agendamento.horario,
        dia_semana: diaDaSemana(agendamento.data_agendada),
      });
      await enviarWhatsApp(agendamento.whatsapp, mensagem);
    } catch (erro) {
      console.error("[whatsapp] falha no lembrete de agendamento", erro);
    }
  })();
}

// ----- Agendamento: cancelado / faltou (src/app/admin/comercial/agendamentos/actions.ts) -----
// Fire-and-forget de propósito: disparadas por uma Server Action de clique do admin, não podem
// travar a resposta pelo tempo do delay anti-banimento.

export function notificarWhatsappAgendamentoCancelado(agendamentoId: string, motivo?: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("agendamentos")
      .select("nome, whatsapp, data_agendada, horario")
      .eq("id", agendamentoId)
      .maybeSingle();
    const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string } | null;
    if (!agendamento?.whatsapp) return;

    const mensagem = await renderTemplate("agendamento_cancelado", {
      nome: primeiroNome(agendamento.nome) || agendamento.nome,
      data: dataBR(agendamento.data_agendada),
      horario: agendamento.horario,
      motivo: motivo?.trim() || "",
    });
    await enviarWhatsApp(agendamento.whatsapp, mensagem);
  });
}

export function notificarWhatsappAgendamentoFalta(agendamentoId: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("agendamentos")
      .select("nome, whatsapp, data_agendada, horario")
      .eq("id", agendamentoId)
      .maybeSingle();
    const agendamento = data as { nome: string; whatsapp: string; data_agendada: string; horario: string } | null;
    if (!agendamento?.whatsapp) return;

    const mensagem = await renderTemplate("agendamento_falta", {
      nome: primeiroNome(agendamento.nome) || agendamento.nome,
      data: dataBR(agendamento.data_agendada),
      horario: agendamento.horario,
    });
    await enviarWhatsApp(agendamento.whatsapp, mensagem);
  });
}

// ----- Cobrança: gerada (src/app/admin/financeiro/actions.ts::gerarCobranca) -----
// Fire-and-forget: disparada por uma Server Action de clique do admin.

type LinhaParcelaCobranca = {
  valor: number;
  numero_parcela: number;
  data_vencimento: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  alunos: { id: string; full_name: string | null; telefone: string | null } | null;
  matriculas: { num_parcelas: number | null; turmas: { cursos: { nome: string } | null } | null } | null;
};

async function carregarParcelaParaCobranca(parcelaId: string): Promise<LinhaParcelaCobranca | null> {
  const { data } = await createAdminClient()
    .from("parcelas")
    .select(
      "valor, numero_parcela, data_vencimento, asaas_invoice_url, asaas_bank_slip_url, alunos(id, full_name, telefone), matriculas(num_parcelas, turmas(cursos(nome)))",
    )
    .eq("id", parcelaId)
    .maybeSingle();
  return data as unknown as LinhaParcelaCobranca | null;
}

function rotuloParcela(parcela: LinhaParcelaCobranca): string {
  const total = parcela.matriculas?.num_parcelas;
  return total && total > 1 ? `${parcela.numero_parcela}/${total}` : String(parcela.numero_parcela);
}

export function notificarWhatsappCobrancaGerada(parcelaId: string): void {
  emSegundoPlano(async () => {
    const parcela = await carregarParcelaParaCobranca(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const curso = parcela.matriculas?.turmas?.cursos?.nome ?? "seu curso";
    // Não há um "código Pix copia-e-cola" separado no sistema — o Pix vem embutido na mesma
    // fatura do boleto (ver notificarEmailCobrancaGerada em src/lib/email/eventos.ts, mesmo
    // critério). O link serve pros dois.
    const link = parcela.asaas_bank_slip_url ?? parcela.asaas_invoice_url ?? "";
    const mensagem = await renderTemplate("cobranca_gerada", {
      nome: primeiroNome(aluno.full_name) || "aluno(a)",
      valor: reais(parcela.valor),
      vencimento: dataBR(parcela.data_vencimento),
      descricao: `Parcela ${rotuloParcela(parcela)} - ${curso}`,
      link_boleto: link,
      codigo_pix: link,
    });
    await enviarWhatsApp(aluno.telefone, mensagem);
  });
}

// ----- Cobrança: atrasada, por faixa de dias (cron verificar-atrasos) -----
// Chamada sequencialmente dentro do loop do cron (o delay entre mensagens é o próprio
// comportamento anti-banimento desejado) — por isso é awaitable, não fire-and-forget.

export function diasParaTemplateAtraso(diasAtraso: number): "cobranca_atrasada_d1" | "cobranca_atrasada_d3" | "cobranca_atrasada_d7" | "cobranca_atrasada_d15" {
  if (diasAtraso >= 15) return "cobranca_atrasada_d15";
  if (diasAtraso >= 7) return "cobranca_atrasada_d7";
  if (diasAtraso >= 3) return "cobranca_atrasada_d3";
  return "cobranca_atrasada_d1";
}

export function notificarWhatsappCobrancaAtrasada(parcelaId: string, diasAtraso: number): Promise<void> {
  return (async () => {
    try {
      const parcela = await carregarParcelaParaCobranca(parcelaId);
      const aluno = parcela?.alunos;
      if (!parcela || !aluno?.telefone) return;

      const link = parcela.asaas_bank_slip_url ?? parcela.asaas_invoice_url ?? "";
      const nome = primeiroNome(aluno.full_name) || "aluno(a)";
      const mensagem = await renderTemplate(diasParaTemplateAtraso(diasAtraso), {
        nome,
        valor: reais(parcela.valor),
        vencimento: dataBR(parcela.data_vencimento),
        dias_atraso: String(diasAtraso),
        link_boleto: link,
      });
      await enviarWhatsApp(aluno.telefone, mensagem);

      // Fluxos personalizados (Fase 3) com gatilho "cobranca_atrasada", além do template acima.
      await dispararFluxosPorGatilho(
        "cobranca_atrasada",
        { telefone: aluno.telefone, nome, valor: reais(parcela.valor), vencimento: dataBR(parcela.data_vencimento), dias_atraso: String(diasAtraso) },
        { tipo: "aluno", id: aluno.id },
      );
    } catch (erro) {
      console.error("[whatsapp] falha na cobrança atrasada", erro);
    }
  })();
}

// ----- Lead: follow-up automático (cron followup-leads) -----
// Awaitable e chamada sequencialmente no loop do cron (mesmo motivo do item anterior).

export function notificarWhatsappLeadFollowup(leadId: string, tentativa: number): Promise<void> {
  return (async () => {
    try {
      const { data } = await createAdminClient().from("leads").select("nome, telefone, cursos(nome)").eq("id", leadId).maybeSingle();
      const lead = data as unknown as { nome: string; telefone: string; cursos: { nome: string } | null } | null;
      if (!lead?.telefone) return;

      const mensagem = await renderTemplate("lead_followup", {
        nome: primeiroNome(lead.nome) || lead.nome,
        curso_interesse: lead.cursos?.nome ?? "nossos cursos",
        nome_escola: await nomeEscolaParaSms(),
        tentativa: String(tentativa),
      });
      await enviarWhatsApp(lead.telefone, mensagem);
    } catch (erro) {
      console.error("[whatsapp] falha no follow-up de lead", erro);
    }
  })();
}

// ----- Dados de acesso da matrícula (botão manual "📱 Dados de acesso") -----
// Continua com mensagem própria (não usa a tabela de templates): é um botão manual e pontual,
// distinto do template "matricula_criada" (que já é o envio AUTOMÁTICO real de
// src/lib/mensagens — ver nota no topo do arquivo). Fire-and-forget de propósito.

export function notificarWhatsappDadosAcesso(matriculaId: string): void {
  emSegundoPlano(async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("matriculas")
      .select("alunos(telefone, email, profiles!alunos_id_fkey(full_name)), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .maybeSingle();

    type Linha = {
      alunos: { telefone: string; email: string | null; profiles: { full_name: string | null } | null } | null;
      turmas: { cursos: { nome: string } | null } | null;
    };
    const matricula = data as unknown as Linha | null;
    const aluno = matricula?.alunos;
    if (!aluno?.telefone) return;

    const nome = primeiroNome(aluno.profiles?.full_name) || "aluno(a)";
    const curso = matricula?.turmas?.cursos?.nome ?? "seu curso";
    const email = aluno.email ?? "o e-mail cadastrado";
    const mensagem = `Olá, ${nome}! 🎓 Aqui estão seus dados de acesso ao curso ${curso}. Acesse a plataforma em ${urlPortal()}/entrar com o e-mail ${email} e a senha cadastrada.`;
    await enviarWhatsApp(aluno.telefone, mensagem);
  });
}
