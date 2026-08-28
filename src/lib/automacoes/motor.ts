import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  notificarPagamentoRecebido,
  notificarPagamentoAtrasado,
  notificarMatriculaCriada,
  notificarCertificadoEmitido,
  notificarLeadNovo,
  notificarAlunoLogin,
  notificarAulaConcluida,
  notificarCursoConcluido,
  notificarEvasaoRisco,
  notificarErroSistema,
} from "@/lib/automacoes/handlers/telegram";
import { gerarResumoDiario } from "@/lib/automacoes/handlers/resumo-diario";
import { gerarRelatorioSemanal } from "@/lib/automacoes/handlers/relatorio-semanal";

type EventoPayload = Record<string, unknown>;

async function executarHandler(tipo: string, payload: EventoPayload): Promise<void> {
  switch (tipo) {
    case "pagamento.recebido":
      await notificarPagamentoRecebido(payload);
      return;
    case "pagamento.atrasado":
      await notificarPagamentoAtrasado(payload);
      return;
    case "matricula.criada":
      await notificarMatriculaCriada(payload);
      return;
    case "certificado.emitido":
      await notificarCertificadoEmitido(payload);
      return;
    case "lead.novo":
      await notificarLeadNovo(payload);
      return;
    case "aluno.login":
      await notificarAlunoLogin(payload);
      return;
    case "aula.concluida":
      await notificarAulaConcluida(payload);
      return;
    case "curso.concluido":
      await notificarCursoConcluido(payload);
      return;
    case "evasao.risco":
      await notificarEvasaoRisco(payload);
      return;
    case "erro.sistema":
      await notificarErroSistema(payload);
      return;
    case "resumo.diario":
      await gerarResumoDiario();
      return;
    case "relatorio.semanal":
      await gerarRelatorioSemanal();
      return;
    default:
      throw new Error(`Tipo de evento de automação desconhecido: ${tipo}`);
  }
}

async function processarEvento(eventoId: string, tipo: string, payload: EventoPayload): Promise<void> {
  const admin = createAdminClient();

  const { data: eventoAtual } = await admin
    .from("eventos_automacao")
    .select("tentativas, max_tentativas")
    .eq("id", eventoId)
    .single();

  const tentativaAtual = (eventoAtual?.tentativas ?? 0) + 1;
  const maxTentativas = eventoAtual?.max_tentativas ?? 3;

  await admin
    .from("eventos_automacao")
    .update({ status: "processando", tentativas: tentativaAtual })
    .eq("id", eventoId);

  try {
    await executarHandler(tipo, payload);

    await admin
      .from("eventos_automacao")
      .update({ status: "concluido", processado_em: new Date().toISOString(), erro: null })
      .eq("id", eventoId);

    await admin.from("log_automacoes").insert({
      evento_id: eventoId,
      tipo,
      descricao: `Evento "${tipo}" processado com sucesso.`,
      payload,
      sucesso: true,
    });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Erro desconhecido.";
    const proximoStatus = tentativaAtual >= maxTentativas ? "falhou" : "pendente";

    await admin
      .from("eventos_automacao")
      .update({ status: proximoStatus, erro: mensagemErro })
      .eq("id", eventoId);

    await admin.from("log_automacoes").insert({
      evento_id: eventoId,
      tipo,
      descricao: `Falha ao processar evento "${tipo}".`,
      payload,
      sucesso: false,
      erro: mensagemErro,
    });
  }
}

// Ponto de entrada do motor — chamado nos pontos de integração do sistema
// (webhook Asaas, criação de matrícula, liberação de certificado, novo
// lead, login de aluno) e pelos cron jobs (resumo diário, relatório
// semanal, verificação de atrasos). Sem fila externa: o evento é
// registrado e processado de forma síncrona, best-effort, na mesma
// invocação — nunca lança exceção, então nunca pode derrubar o fluxo
// principal que o disparou.
export async function dispararEvento(
  tipo: string,
  payload: EventoPayload,
  idempotencyKey: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: existente } = await admin
      .from("eventos_automacao")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existente) return;

    const { data: evento, error } = await admin
      .from("eventos_automacao")
      .insert({ tipo, payload, idempotency_key: idempotencyKey, status: "pendente" })
      .select("id")
      .single();

    if (error || !evento) return;

    await processarEvento(evento.id, tipo, payload);
  } catch {
    // Best-effort de verdade: qualquer falha aqui (insert, rede do Telegram,
    // handler desconhecido) já foi tratada/logada acima ou é irrelevante
    // pro chamador — nunca propaga.
  }
}

// Reprocessa um evento existente (botão "Reprocessar" em
// /admin/automacoes, ver src/components/admin/automacoes-log-view.tsx) —
// não passa pela checagem de idempotência porque é o mesmo evento sendo
// tentado de novo, não um evento novo.
export async function reprocessarEvento(eventoId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: evento } = await admin
      .from("eventos_automacao")
      .select("tipo, payload")
      .eq("id", eventoId)
      .single();

    if (!evento) return;

    await processarEvento(eventoId, evento.tipo, evento.payload as EventoPayload);
  } catch {
    // Best-effort — mesmo racional de dispararEvento acima.
  }
}
