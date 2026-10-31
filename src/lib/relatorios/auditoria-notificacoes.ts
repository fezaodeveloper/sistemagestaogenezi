import "server-only";

// Auditoria de notificações (TAREFA) — todas as queries do painel "Auditoria" em
// /admin/automacoes. Lê direto de public.mensagens_enviadas (log real já existente — ver
// resumo da tarefa pras PERGUNTAS DE FATO/desvios do SQL original).

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AlunoDiagnosticoTurma,
  AlunoSemLembrete,
  FiltrosHistorico,
  HistoricoNotificacao,
  TurmaOpcao,
  VisaoGeralAuditoria,
} from "./auditoria-notificacoes-shared";

type Supabase = ReturnType<typeof createAdminClient>;

function isoDiasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

// "Número suspeito" (TAREFA): o telefone é gravado SEM o "55" (normalizarTelefone acrescenta na
// hora de enviar, nunca fica salvo assim em alunos.telefone — ver lib/mensagens/texto.ts) — checar
// "começa com 55" no valor crú marcaria TODO aluno como suspeito, então o critério real aqui é
// só a quantidade de dígitos, a mesma regra já validada no cadastro (10 ou 11, com DDD).
export function numeroSuspeito(telefone: string | null): boolean {
  if (!telefone) return true;
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length < 10 || digitos.length > 11;
}

// ===== Visão geral =====

export async function getVisaoGeralAuditoria(admin: Supabase): Promise<VisaoGeralAuditoria> {
  const desde = isoDiasAtras(30);

  const [{ count: enviados }, { count: erros }, { data: matriculasAtivas }, { data: comNotificacao }] = await Promise.all([
    admin.from("mensagens_enviadas").select("id", { count: "exact", head: true }).eq("status", "enviado").gte("created_at", desde),
    admin.from("mensagens_enviadas").select("id", { count: "exact", head: true }).eq("status", "falha").gte("created_at", desde),
    admin.from("matriculas").select("id").eq("status", "ativa"),
    admin.from("mensagens_enviadas").select("matricula_id").not("matricula_id", "is", null),
  ]);

  const idsMatriculasAtivas = new Set((matriculasAtivas ?? []).map((m) => m.id as string));
  const idsComNotificacao = new Set((comNotificacao ?? []).map((m) => m.matricula_id as string));
  const semNotificacao = [...idsMatriculasAtivas].filter((id) => !idsComNotificacao.has(id)).length;

  const totalEnviados30d = enviados ?? 0;
  const totalErros30d = erros ?? 0;
  const totalTentativas = totalEnviados30d + totalErros30d;

  return {
    totalEnviados30d,
    totalErros30d,
    percentualSucesso: totalTentativas > 0 ? Math.round((totalEnviados30d / totalTentativas) * 100) : 0,
    alunosSemNotificacao: semNotificacao,
  };
}

// ===== Alunos sem lembrete de aula (últimos 7 dias) =====

type LinhaMatriculaAtiva = {
  id: string;
  alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null;
  turmas: { nome: string } | null;
};

export async function getAlunosSemLembreteAula(admin: Supabase): Promise<AlunoSemLembrete[]> {
  const { data: matriculas } = await admin
    .from("matriculas")
    .select("id, alunos(telefone, profiles!alunos_id_fkey(full_name)), turmas(nome)")
    .eq("status", "ativa");

  const lista = (matriculas ?? []) as unknown as LinhaMatriculaAtiva[];
  if (lista.length === 0) return [];

  const desde7d = isoDiasAtras(7);
  const idsMatricula = lista.map((m) => m.id);

  const [{ data: enviadosRecentes }, { data: ultimosEnviosGerais }] = await Promise.all([
    admin
      .from("mensagens_enviadas")
      .select("matricula_id")
      .eq("tipo", "lembrete_aula")
      .eq("status", "enviado")
      .gte("created_at", desde7d)
      .in("matricula_id", idsMatricula),
    admin
      .from("mensagens_enviadas")
      .select("matricula_id, created_at")
      .eq("tipo", "lembrete_aula")
      .eq("status", "enviado")
      .in("matricula_id", idsMatricula)
      .order("created_at", { ascending: false }),
  ]);

  const receberamNos7d = new Set((enviadosRecentes ?? []).map((m) => m.matricula_id as string));
  const ultimoEnvioPorMatricula = new Map<string, string>();
  for (const linha of (ultimosEnviosGerais ?? []) as { matricula_id: string; created_at: string }[]) {
    if (!ultimoEnvioPorMatricula.has(linha.matricula_id)) ultimoEnvioPorMatricula.set(linha.matricula_id, linha.created_at);
  }

  return lista
    .filter((matricula) => !receberamNos7d.has(matricula.id))
    .map((matricula) => ({
      matriculaId: matricula.id,
      alunoNome: matricula.alunos?.profiles?.full_name ?? "—",
      turmaNome: matricula.turmas?.nome ?? "—",
      whatsapp: matricula.alunos?.telefone ?? null,
      ultimoEnvio: ultimoEnvioPorMatricula.get(matricula.id) ?? null,
      numeroSuspeito: numeroSuspeito(matricula.alunos?.telefone ?? null),
    }));
}

// ===== Diagnóstico por turma =====

export async function getTurmasAtivasParaSelect(admin: Supabase): Promise<TurmaOpcao[]> {
  const { data } = await admin.from("turmas").select("id, nome").eq("status", "ativa").order("nome");
  return (data ?? []) as TurmaOpcao[];
}

export async function getDiagnosticoTurma(admin: Supabase, turmaId: string): Promise<AlunoDiagnosticoTurma[]> {
  const { data: matriculas } = await admin
    .from("matriculas")
    .select("id, alunos(telefone, profiles!alunos_id_fkey(full_name))")
    .eq("turma_id", turmaId)
    .eq("status", "ativa");

  type Linha = { id: string; alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null };
  const lista = (matriculas ?? []) as unknown as Linha[];
  if (lista.length === 0) return [];

  const idsMatricula = lista.map((m) => m.id);
  const { data: envios } = await admin
    .from("mensagens_enviadas")
    .select("matricula_id, status, created_at")
    .eq("tipo", "lembrete_aula")
    .in("matricula_id", idsMatricula)
    .order("created_at", { ascending: false });

  const ultimoPorMatricula = new Map<string, { status: "enviado" | "falha"; created_at: string }>();
  for (const linha of (envios ?? []) as { matricula_id: string; status: "enviado" | "falha"; created_at: string }[]) {
    if (!ultimoPorMatricula.has(linha.matricula_id)) ultimoPorMatricula.set(linha.matricula_id, linha);
  }

  return lista.map((matricula) => {
    const ultimo = ultimoPorMatricula.get(matricula.id);
    return {
      matriculaId: matricula.id,
      alunoNome: matricula.alunos?.profiles?.full_name ?? "—",
      whatsapp: matricula.alunos?.telefone ?? null,
      recebeu: ultimo?.status === "enviado",
      ultimoEnvio: ultimo?.created_at ?? null,
      ultimoStatus: ultimo?.status ?? null,
    };
  });
}

// ===== Histórico completo (paginado) =====

export async function getHistoricoNotificacoes(
  admin: Supabase,
  filtros: FiltrosHistorico,
): Promise<{ itens: HistoricoNotificacao[]; total: number }> {
  let query = admin
    .from("mensagens_enviadas")
    .select(
      "id, created_at, status, erro_detalhe, tipo, created_by, matriculas(alunos(profiles!alunos_id_fkey(full_name)), turmas(nome)), leads(nome)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.status) query = query.eq("status", filtros.status);

  // Filtro por turma: resolvido ANTES (ids de matrícula daquela turma) — a turma só existe via
  // matriculas(turmas(...)), e o PostgREST não filtra por coluna de um embed aninhado dentro de
  // outro embed diretamente.
  if (filtros.turmaId) {
    const { data: idsMatriculaDaTurma } = await admin.from("matriculas").select("id").eq("turma_id", filtros.turmaId);
    const idsValidos = (idsMatriculaDaTurma ?? []).map((m) => m.id as string);
    query = idsValidos.length > 0 ? query.in("matricula_id", idsValidos) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const offset = (filtros.page - 1) * filtros.limite;
  const { data, count } = await query.range(offset, offset + filtros.limite - 1);

  type Linha = {
    id: string;
    created_at: string;
    status: "pendente" | "enviado" | "falha";
    erro_detalhe: string | null;
    tipo: string;
    created_by: string | null;
    matriculas: { alunos: { profiles: { full_name: string | null } | null } | null; turmas: { nome: string } | null } | null;
    leads: { nome: string } | null;
  };

  const itens = ((data ?? []) as unknown as Linha[]).map((linha) => ({
    id: linha.id,
    createdAt: linha.created_at,
    alunoOuLeadNome: linha.matriculas?.alunos?.profiles?.full_name ?? linha.leads?.nome ?? "—",
    turmaNome: linha.matriculas?.turmas?.nome ?? null,
    tipo: linha.tipo,
    canal: "whatsapp" as const,
    status: linha.status,
    erro: linha.erro_detalhe,
    enviadoPor: linha.created_by ? ("manual" as const) : ("sistema" as const),
  }));

  return { itens, total: count ?? 0 };
}
