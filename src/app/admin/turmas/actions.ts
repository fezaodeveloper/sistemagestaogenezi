"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { turmaFormSchema } from "@/lib/turmas/schema";
import { enviarMensagemLeadRecontato } from "@/lib/mensagens/mensagens";

type TurmaFormValuesEcho = {
  curso_id: string;
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
};

export type TurmaFormState =
  | {
      errors?: Partial<
        Record<
          | "curso_id"
          | "nome"
          | "data_inicio"
          | "data_fim"
          | "capacidade_maxima"
          | "status"
          | "cadencia_dias_semana"
          | "local_sala"
          | "professor"
          | "observacoes",
          string[]
        >
      >;
      error?: string;
      values?: TurmaFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): TurmaFormValuesEcho {
  return {
    curso_id: String(formData.get("curso_id") ?? ""),
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
  };
}

function parseTurmaForm(formData: FormData) {
  return turmaFormSchema.safeParse({
    curso_id: formData.get("curso_id"),
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
    parsed.data.curso_id,
    parsed.data.cadencia_dias_semana ?? [],
  );
  if (!cadencia.ok) {
    return {
      error: cadencia.error,
      errors: cadencia.fieldError ? { cadencia_dias_semana: [cadencia.fieldError] } : undefined,
      values: echoValues(formData),
    };
  }

  const { error } = await supabase.from("turmas").insert({
    curso_id: parsed.data.curso_id,
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
  });

  if (error) {
    return {
      error: "Não foi possível criar a turma. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Campanha automática de recontato: leads em aberto (novo/contatado)
  // interessados nesse curso são avisados que uma turma nova abriu.
  // Best-effort, nunca bloqueia a criação da turma (já concluída acima).
  const { data: leadsInteressados } = await supabase
    .from("leads")
    .select("id")
    .eq("curso_id", parsed.data.curso_id)
    .in("status", ["novo", "contatado"]);

  await Promise.all(
    (leadsInteressados ?? []).map((lead) =>
      enviarMensagemLeadRecontato(lead.id, user.id, {
        nomeTurma: parsed.data.nome,
        dataInicioTurma: parsed.data.data_inicio,
      }),
    ),
  );

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
    parsed.data.curso_id,
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
      curso_id: parsed.data.curso_id,
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
    })
    .eq("id", id);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/turmas");
  redirect("/admin/turmas");
}

export async function deleteTurma(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("turmas").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a turma." };
  }

  revalidatePath("/admin/turmas");
  return {};
}
