"use server";

// Regras de recorrência configuráveis (lembrete de aula, WhatsApp/Telegram personalizados) +
// histórico de envios (mensagens_enviadas). Arquivo próprio, separado do já enorme
// src/app/admin/configuracoes/actions.ts — ver migration 20261022130000_config_recorrencia_
// notificacoes.sql. Constantes/tipos/schema vivem em src/lib/regras-notificacao/schema.ts (um
// arquivo "use server" só pode exportar async functions).
//
// LOCALIZAÇÃO: a tarefa original pedia essas seções em /admin/notificacoes, mas essa página é
// sobre notificações PUSH no navegador (push_templates/push_agendamentos — canal totalmente
// diferente, ver src/app/admin/notificacoes/page.tsx). As regras daqui são sobre WhatsApp/
// Telegram/lembrete de aula — o mesmo assunto da aba "Notificações" de /admin/configuracoes,
// onde já vive ConfigHorariosNotificacoesForm (lembrete_aula_*/lembrete_pagamento_*). Por isso
// as novas seções entram ali, não em /admin/notificacoes.

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  regraNotificacaoFormSchema,
  type HistoricoEnvioLinha,
  type HistoricoEnvios,
  type RegraNotificacao,
  type RegraNotificacaoActionResult,
  type RegraNotificacaoFormValues,
  type RegraNotificacaoRecorrencia,
} from "@/lib/regras-notificacao/schema";

function parseRegraForm(dados: unknown) {
  return regraNotificacaoFormSchema.safeParse(dados);
}

// dia_semana só faz sentido pra recorrência "semanal" — nula nos outros casos, mesmo quando o
// form enviou um valor (ex.: admin trocou de "semanal" pra "diário" sem limpar o select).
function diaSemanaEfetivo(recorrencia: RegraNotificacaoRecorrencia, diaSemana: number | null | undefined): number | null {
  return recorrencia === "semanal" ? diaSemana ?? null : null;
}

export async function listarRegras(): Promise<RegraNotificacao[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("regras_notificacao").select("*").order("nome");
  return (data as RegraNotificacao[] | null) ?? [];
}

export async function criarRegra(dados: RegraNotificacaoFormValues): Promise<RegraNotificacaoActionResult> {
  const user = await requireRole("admin");

  const parsed = parseRegraForm(dados);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("regras_notificacao").insert({
    nome: data.nome,
    tipo: data.tipo,
    destino: data.destino,
    recorrencia: data.recorrencia,
    dia_semana: diaSemanaEfetivo(data.recorrencia, data.dia_semana),
    hora_envio: data.hora_envio,
    mensagem_template: data.mensagem_template ?? null,
    proxima_execucao: data.proxima_execucao,
    created_by: user.id,
  });

  if (error) {
    return { error: "Não foi possível criar a regra. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export async function atualizarRegra(
  id: string,
  dados: RegraNotificacaoFormValues,
): Promise<RegraNotificacaoActionResult> {
  await requireRole("admin");

  const parsed = parseRegraForm(dados);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const { data: regraAtual } = await supabase
    .from("regras_notificacao")
    .select("recorrencia")
    .eq("id", id)
    .maybeSingle();

  // Recorrência mudou: a data escolhida no form (pensada pra recorrência antiga) deixa de fazer
  // sentido — recalcula a partir de hoje pela nova recorrência, em vez de confiar no valor
  // submetido. Sem mudança de recorrência, respeita a data que o admin digitou/ajustou no form.
  let proximaExecucao = data.proxima_execucao;
  if (regraAtual && regraAtual.recorrencia !== data.recorrencia) {
    const dias = { diario: 1, semanal: 7, quinzenal: 15, mensal: 30 }[data.recorrencia];
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const [ano, mes, dia] = hoje.split("-").map(Number);
    proximaExecucao = new Date(Date.UTC(ano, mes - 1, dia + dias, 12)).toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("regras_notificacao")
    .update({
      nome: data.nome,
      tipo: data.tipo,
      destino: data.destino,
      recorrencia: data.recorrencia,
      dia_semana: diaSemanaEfetivo(data.recorrencia, data.dia_semana),
      hora_envio: data.hora_envio,
      mensagem_template: data.mensagem_template ?? null,
      proxima_execucao: proximaExecucao,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export async function toggleRegra(id: string, ativo: boolean): Promise<RegraNotificacaoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("regras_notificacao").update({ ativo }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar a regra. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export async function excluirRegra(id: string): Promise<RegraNotificacaoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("regras_notificacao").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a regra. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

// ===== Histórico de Envios (mensagens_enviadas) =====

type LinhaMensagemEnviada = {
  id: string;
  tipo: string;
  status: string;
  created_at: string;
  matricula_id: string | null;
  aula_id: string | null;
  matriculas: { alunos: { full_name: string | null } | null } | null;
  leads: { nome: string } | null;
};

export async function getHistoricoEnvios(): Promise<HistoricoEnvios> {
  await requireRole("admin");
  const supabase = await createClient();

  const hojeBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [ano, mes, dia] = hojeBRT.split("-").map(Number);
  const inicioHoje = new Date(Date.UTC(ano, mes - 1, dia, 3, 0, 0)).toISOString(); // 0h BRT = 3h UTC
  const inicioSemana = new Date(Date.UTC(ano, mes - 1, dia - 6, 3, 0, 0)).toISOString();
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1, 3, 0, 0)).toISOString();

  const [{ data: ultimosRaw }, { count: totalHoje }, { count: totalSemana }, { count: totalMes }, { data: paraDuplicatas }] =
    await Promise.all([
      supabase
        .from("mensagens_enviadas")
        .select("id, tipo, status, created_at, matricula_id, aula_id, matriculas(alunos(full_name)), leads(nome)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("mensagens_enviadas").select("id", { count: "exact", head: true }).gte("created_at", inicioHoje),
      supabase.from("mensagens_enviadas").select("id", { count: "exact", head: true }).gte("created_at", inicioSemana),
      supabase.from("mensagens_enviadas").select("id", { count: "exact", head: true }).gte("created_at", inicioMes),
      // Só mensagens com aula_id (lembrete_aula/falta) fazem sentido pra essa checagem —
      // matricula_criada/lead_recontato têm aula_id sempre nulo, e "mais de uma por matrícula"
      // aí seria normal (várias matrículas diferentes), não duplicata.
      supabase
        .from("mensagens_enviadas")
        .select("matricula_id, aula_id, tipo, created_at")
        .not("aula_id", "is", null)
        .gte("created_at", inicioMes),
    ]);

  const linhas = (ultimosRaw ?? []) as unknown as LinhaMensagemEnviada[];

  const ultimos: HistoricoEnvioLinha[] = linhas.map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    destinatario: linha.matriculas?.alunos?.full_name ?? linha.leads?.nome ?? "—",
    status: linha.status,
    created_at: linha.created_at,
  }));

  const contagemPorTipo: Record<string, number> = {};
  for (const linha of linhas) {
    contagemPorTipo[linha.tipo] = (contagemPorTipo[linha.tipo] ?? 0) + 1;
  }

  // Duplicata = mais de 1 linha com o mesmo matricula_id+aula_id+tipo. Simplificação da regra
  // literal "em menos de 24h": como este cron só roda 1x/dia, duas linhas do mesmo grupo quase
  // sempre caem dentro de 24h uma da outra de qualquer forma — checar só a contagem por grupo
  // evita uma comparação par-a-par de timestamps sem perder precisão na prática.
  const gruposDuplicados = new Map<string, number>();
  for (const linha of paraDuplicatas ?? []) {
    const chave = `${linha.matricula_id}:${linha.aula_id}:${linha.tipo}`;
    gruposDuplicados.set(chave, (gruposDuplicados.get(chave) ?? 0) + 1);
  }
  const duplicatasDetectadas = Array.from(gruposDuplicados.values()).filter((qtd) => qtd > 1).length;

  return {
    ultimos,
    contagemPorTipo,
    totalHoje: totalHoje ?? 0,
    totalSemana: totalSemana ?? 0,
    totalMes: totalMes ?? 0,
    duplicatasDetectadas,
  };
}
