"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { turmaFormSchema } from "@/lib/turmas/schema";
import { enviarMensagemLeadRecontato } from "@/lib/mensagens/mensagens";
import { regenerarCronogramaAoSalvarTurma } from "@/lib/cronograma/gerador";

type TurmaFormValuesEcho = {
  curso_ids: string[];
  nome: string;
  data_inicio: string;
  data_fim: string;
  capacidade_maxima: string;
  status: string;
  cadencia_dias_semana: string[];
  horario_aula: string;
  turno: string;
  local_sala: string;
  professor: string;
  horario_fim: string;
  observacoes: string;
  telegram_chat_id: string;
};

export type TurmaFormState =
  | {
      errors?: Partial<
        Record<
          | "curso_ids"
          | "nome"
          | "data_inicio"
          | "data_fim"
          | "capacidade_maxima"
          | "status"
          | "cadencia_dias_semana"
          | "local_sala"
          | "professor"
          | "observacoes"
          | "telegram_chat_id",
          string[]
        >
      >;
      error?: string;
      values?: TurmaFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): TurmaFormValuesEcho {
  return {
    curso_ids: formData.getAll("curso_ids").map(String),
    nome: String(formData.get("nome") ?? ""),
    data_inicio: String(formData.get("data_inicio") ?? ""),
    data_fim: String(formData.get("data_fim") ?? ""),
    capacidade_maxima: String(formData.get("capacidade_maxima") ?? ""),
    status: String(formData.get("status") ?? ""),
    cadencia_dias_semana: formData.getAll("cadencia_dias_semana").map(String),
    horario_aula: String(formData.get("horario_aula") ?? ""),
    turno: String(formData.get("turno") ?? ""),
    local_sala: String(formData.get("local_sala") ?? ""),
    professor: String(formData.get("professor") ?? ""),
    horario_fim: String(formData.get("horario_fim") ?? ""),
    observacoes: String(formData.get("observacoes") ?? ""),
    telegram_chat_id: String(formData.get("telegram_chat_id") ?? ""),
  };
}

function parseTurmaForm(formData: FormData) {
  return turmaFormSchema.safeParse({
    curso_ids: formData.getAll("curso_ids"),
    nome: formData.get("nome"),
    data_inicio: formData.get("data_inicio"),
    data_fim: formData.get("data_fim"),
    capacidade_maxima: formData.get("capacidade_maxima"),
    status: formData.get("status"),
    cadencia_dias_semana: formData.getAll("cadencia_dias_semana"),
    horario_aula: formData.get("horario_aula"),
    turno: formData.get("turno"),
    local_sala: formData.get("local_sala"),
    professor: formData.get("professor"),
    horario_fim: formData.get("horario_fim"),
    observacoes: formData.get("observacoes"),
    telegram_chat_id: formData.get("telegram_chat_id"),
  });
}

// Turma de curso EAD não usa cadência — zera o valor no servidor
// independente do que veio no submit (nunca confiar que o client escondeu
// o campo direito). Turma de curso presencial/híbrido exige pelo menos 1
// dia selecionado.
async function resolverCadencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoId: string,
  diasSelecionados: string[],
): Promise<
  | { ok: true; cadenciaDiasSemana: string[] | null }
  | { ok: false; error?: string; fieldError?: string }
> {
  const { data: curso } = await supabase.from("cursos").select("tipo").eq("id", cursoId).single();
  if (!curso) {
    return { ok: false, error: "Curso não encontrado." };
  }

  if (curso.tipo === "ead") {
    return { ok: true, cadenciaDiasSemana: null };
  }

  if (diasSelecionados.length === 0) {
    return { ok: false, fieldError: "Selecione ao menos um dia da semana." };
  }

  return { ok: true, cadenciaDiasSemana: diasSelecionados };
}

// TAREFA múltiplos cursos por turma — sincroniza turma_cursos com a lista escolhida no form
// (insere novos, remove os tirados, grava a ordem = índice na lista). Best-effort: nunca pode
// impedir o salvamento da turma em si (já concluído antes desta chamada, igual ao cronograma).
async function sincronizarTurmaCursos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  turmaId: string,
  cursoIds: string[],
): Promise<void> {
  try {
    await supabase.from("turma_cursos").delete().eq("turma_id", turmaId);
    await supabase.from("turma_cursos").insert(cursoIds.map((cursoId, ordem) => ({ turma_id: turmaId, curso_id: cursoId, ordem })));
  } catch (erro) {
    console.error("[turmas] falha ao sincronizar turma_cursos:", erro);
  }
}

// Leads interessados em QUALQUER um dos cursos vinculados à turma (não só o principal) são
// avisados — turma com múltiplos cursos é relevante pra quem demonstrou interesse em qualquer um
// deles. Best-effort, nunca bloqueia a criação da turma.
async function notificarLeadsInteressados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoIds: string[],
  nomeTurma: string,
  dataInicioTurma: string,
  criadoPor: string,
): Promise<void> {
  const { data: leadsInteressados } = await supabase.from("leads").select("id").in("curso_id", cursoIds).in("status", ["novo", "contatado"]);

  await Promise.all(
    (leadsInteressados ?? []).map((lead) =>
      enviarMensagemLeadRecontato(lead.id, criadoPor, { nomeTurma, dataInicioTurma }),
    ),
  );
}

export async function createTurma(
  _prevState: TurmaFormState,
  formData: FormData,
): Promise<TurmaFormState> {
  const user = await requireRole("admin");

  const parsed = parseTurmaForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();

  const cadencia = await resolverCadencia(
    supabase,
    parsed.data.curso_ids[0],
    parsed.data.cadencia_dias_semana ?? [],
  );
  if (!cadencia.ok) {
    return {
      error: cadencia.error,
      errors: cadencia.fieldError ? { cadencia_dias_semana: [cadencia.fieldError] } : undefined,
      values: echoValues(formData),
    };
  }

  const { data: novaTurma, error } = await supabase
    .from("turmas")
    .insert({
      // "Curso principal" (compatibilidade com o código legado) — ver resumo da tarefa.
      curso_id: parsed.data.curso_ids[0],
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      data_fim: parsed.data.data_fim,
      capacidade_maxima: parsed.data.capacidade_maxima,
      status: parsed.data.status,
      cadencia_dias_semana: cadencia.cadenciaDiasSemana,
      horario_aula: parsed.data.horario_aula ?? null,
      turno: parsed.data.turno ?? null,
      local_sala: parsed.data.local_sala ?? null,
      professor: parsed.data.professor ?? null,
      horario_fim: parsed.data.horario_fim ?? null,
      observacoes: parsed.data.observacoes ?? null,
      telegram_chat_id: parsed.data.telegram_chat_id ?? null,
    })
    .select("id")
    .single();

  if (error || !novaTurma) {
    return {
      error: "Não foi possível criar a turma. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Best-effort — nunca impede a criação da turma (já concluída acima).
  if (cadencia.cadenciaDiasSemana) {
    await regenerarCronogramaAoSalvarTurma(novaTurma.id, supabase);
  }
  await sincronizarTurmaCursos(supabase, novaTurma.id, parsed.data.curso_ids);

  // Campanha automática de recontato: leads em aberto (novo/contatado) interessados em QUALQUER
  // um dos cursos vinculados são avisados que uma turma nova abriu. Best-effort, nunca bloqueia
  // a criação da turma (já concluída acima).
  await notificarLeadsInteressados(supabase, parsed.data.curso_ids, parsed.data.nome, parsed.data.data_inicio, user.id);

  revalidatePath("/admin/turmas");
  redirect("/admin/turmas");
}

export async function updateTurma(
  id: string,
  _prevState: TurmaFormState,
  formData: FormData,
): Promise<TurmaFormState> {
  await requireRole("admin");

  const parsed = parseTurmaForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();

  const cadencia = await resolverCadencia(
    supabase,
    parsed.data.curso_ids[0],
    parsed.data.cadencia_dias_semana ?? [],
  );
  if (!cadencia.ok) {
    return {
      error: cadencia.error,
      errors: cadencia.fieldError ? { cadencia_dias_semana: [cadencia.fieldError] } : undefined,
      values: echoValues(formData),
    };
  }

  const { error } = await supabase
    .from("turmas")
    .update({
      curso_id: parsed.data.curso_ids[0],
      nome: parsed.data.nome,
      data_inicio: parsed.data.data_inicio,
      data_fim: parsed.data.data_fim,
      capacidade_maxima: parsed.data.capacidade_maxima,
      status: parsed.data.status,
      cadencia_dias_semana: cadencia.cadenciaDiasSemana,
      horario_aula: parsed.data.horario_aula ?? null,
      turno: parsed.data.turno ?? null,
      local_sala: parsed.data.local_sala ?? null,
      professor: parsed.data.professor ?? null,
      horario_fim: parsed.data.horario_fim ?? null,
      observacoes: parsed.data.observacoes ?? null,
      telegram_chat_id: parsed.data.telegram_chat_id ?? null,
    })
    .eq("id", id);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Best-effort — nunca impede o salvamento da turma (já concluído acima).
  if (cadencia.cadenciaDiasSemana) {
    await regenerarCronogramaAoSalvarTurma(id, supabase);
  }
  await sincronizarTurmaCursos(supabase, id, parsed.data.curso_ids);

  revalidatePath("/admin/turmas");
  redirect("/admin/turmas");
}

export async function deleteTurma(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();

  // matriculas.turma_id é "on delete restrict" (não cascade) — excluir a turma com QUALQUER
  // matrícula ainda apontando pra ela falha na FK, mesmo uma matrícula cancelada há meses. Só
  // "status = cancelada" pode ser removido antes pra liberar a exclusão; qualquer outro status
  // (ativa, inativa, concluída, transferida) bloqueia de propósito — apagar a turma apagaria o
  // histórico acadêmico/financeiro de um aluno que passou por ela de verdade.
  // (alunos.turma_id também é "on delete restrict", mas é uma coluna legada nunca preenchida
  // pelo app — toda matrícula de verdade vive em `matriculas` — então nunca bloqueia na prática.)
  const { data: matriculas, error: matriculasError } = await supabase
    .from("matriculas")
    .select("id, status")
    .eq("turma_id", id);

  if (matriculasError) {
    console.error("[deleteTurma] erro ao verificar matrículas:", matriculasError);
    return { error: "Não foi possível verificar as matrículas desta turma. Tente novamente." };
  }

  const vinculadas = matriculas ?? [];
  const bloqueantes = vinculadas.filter((m) => m.status !== "cancelada");
  const canceladas = vinculadas.filter((m) => m.status === "cancelada");

  if (bloqueantes.length > 0) {
    return {
      error: `Não é possível excluir: ${bloqueantes.length} matrícula(s) não cancelada(s) ainda vinculada(s) a esta turma. Cancele ou transfira essas matrículas antes de excluir.`,
    };
  }

  if (canceladas.length > 0) {
    const { error: limpezaError } = await supabase
      .from("matriculas")
      .delete()
      .in(
        "id",
        canceladas.map((m) => m.id),
      );

    if (limpezaError) {
      console.error("[deleteTurma] erro ao limpar matrículas canceladas:", limpezaError);
      return { error: "Não foi possível remover as matrículas canceladas desta turma. Tente novamente." };
    }
  }

  const { error } = await supabase.from("turmas").delete().eq("id", id);

  if (error) {
    console.error("[deleteTurma] erro Supabase:", error);
    // 23503 = foreign_key_violation — sobrou alguma referência que não previmos acima.
    if (error.code === "23503") {
      return { error: "Não é possível excluir: ainda existem registros vinculados a esta turma." };
    }
    return { error: "Não foi possível excluir a turma." };
  }

  revalidatePath("/admin/turmas");
  return {};
}

// Cópia criada como "planejada" (não existe status "inativa" no enum de
// turmas — TURMA_STATUSES é planejada/ativa/encerrada/cancelada) pra não
// ativar a turma nova por acidente antes do admin revisar/ajustar os dados.
// vagas_ocupadas não é copiado (nem faz parte do insert, igual createTurma)
// porque a cópia começa sem nenhum aluno matriculado.
export async function duplicarTurma(turmaId: string): Promise<{ id: string } | { error: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: turma } = await supabase.from("turmas").select("*, turma_cursos(curso_id, ordem)").eq("id", turmaId).single();

  if (!turma) {
    return { error: "Turma não encontrada." };
  }

  const { data: novaTurma, error } = await supabase
    .from("turmas")
    .insert({
      curso_id: turma.curso_id,
      nome: `${turma.nome} (cópia)`,
      data_inicio: turma.data_inicio,
      data_fim: turma.data_fim,
      capacidade_maxima: turma.capacidade_maxima,
      status: "planejada",
      cadencia_dias_semana: turma.cadencia_dias_semana,
      horario_aula: turma.horario_aula,
      turno: turma.turno,
      local_sala: turma.local_sala,
      professor: turma.professor,
      horario_fim: turma.horario_fim,
      observacoes: turma.observacoes,
      telegram_chat_id: turma.telegram_chat_id,
    })
    .select("id")
    .single();

  if (error || !novaTurma) {
    return { error: "Não foi possível duplicar a turma." };
  }

  const cursoIdsOrdenados = ((turma.turma_cursos ?? []) as { curso_id: string; ordem: number }[])
    .sort((a, b) => a.ordem - b.ordem)
    .map((v) => v.curso_id);
  await sincronizarTurmaCursos(supabase, novaTurma.id, cursoIdsOrdenados.length > 0 ? cursoIdsOrdenados : [turma.curso_id]);

  revalidatePath("/admin/turmas");
  return { id: novaTurma.id };
}
