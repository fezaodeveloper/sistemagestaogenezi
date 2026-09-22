import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";

// Eventos do sistema que disparam WhatsApp via GênZap. Cada função agenda o envio pra DEPOIS da
// resposta (after) e engole qualquer erro — nunca atrasa nem quebra o fluxo que chamou (mesmo
// padrão de src/lib/integrax/notificacoes.ts). Com o GênZap desligado/desconectado,
// enviarWhatsApp() só registra no console o que SERIA enviado.
//
// Os outros 3 eventos de mensagem (matrícula criada, lembrete de aula, falta, recontato de lead)
// já são reais desde a Fase 13 — ver src/lib/mensagens/mensagens.ts — e não são tocados aqui.

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

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

function urlPortal(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

// ----- Lembrete D-1 de agendamento (cron lembrete-agendamentos) -----

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

      const nome = primeiroNome(agendamento.nome) || agendamento.nome;
      const mensagem = `Olá, ${nome}! 👋 Passando para lembrar do seu agendamento amanhã, dia ${dataBR(agendamento.data_agendada)} às ${agendamento.horario}. Até lá!`;
      await enviarWhatsApp(agendamento.whatsapp, mensagem);
    } catch (erro) {
      console.error("[whatsapp] falha no lembrete de agendamento", erro);
    }
  })();
}

// ----- Follow-up automático de lead (cron followup-leads) -----

export function notificarWhatsappLeadFollowup(leadId: string): Promise<void> {
  return (async () => {
    try {
      const { data } = await createAdminClient().from("leads").select("nome, telefone, cursos(nome)").eq("id", leadId).maybeSingle();
      const lead = data as unknown as { nome: string; telefone: string; cursos: { nome: string } | null } | null;
      if (!lead?.telefone) return;

      const nome = primeiroNome(lead.nome) || lead.nome;
      const curso = lead.cursos?.nome ?? "nossos cursos";
      const mensagem = `Olá, ${nome}! 😊 Vimos seu interesse em ${curso} e queremos te ajudar a dar o próximo passo. Podemos conversar?`;
      await enviarWhatsApp(lead.telefone, mensagem);
    } catch (erro) {
      console.error("[whatsapp] falha no follow-up de lead", erro);
    }
  })();
}

// ----- Dados de acesso da matrícula (botão manual "📱 Dados de acesso") -----
// Fire-and-forget de propósito (emSegundoPlano/after): disparado por um clique do admin numa
// Server Action, não pode travar a resposta pelo tempo do delay anti-banimento.

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
