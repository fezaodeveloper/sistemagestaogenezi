"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarFeriados } from "@/lib/calendario/feriados-api";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import {
  eventoFormSchema,
  type EventoCalendarioComRelacoes,
} from "@/lib/calendario/schema";

export async function getEventos(
  ano: number,
  mes?: number,
): Promise<EventoCalendarioComRelacoes[]> {
  await requireRole("admin");

  const supabase = await createClient();
  let query = supabase
    .from("eventos_calendario")
    .select("*, cursos(nome), turmas(nome)")
    .order("data_inicio");

  if (mes) {
    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaDoMes).padStart(2, "0")}`;
    query = query.gte("data_inicio", inicio).lte("data_inicio", fim);
  } else {
    query = query.gte("data_inicio", `${ano}-01-01`).lte("data_inicio", `${ano}-12-31`);
  }

  const { data } = await query;
  return (data as EventoCalendarioComRelacoes[] | null) ?? [];
}

type EventoFormValuesEcho = {
  nome: string;
  tipo: string;
  tipo_feriado: string;
  data_inicio: string;
  data_fim: string;
  horario_inicio: string;
  horario_fim: string;
  abrangencia: string;
  curso_id: string;
  turma_id: string;
  gera_notificacao: boolean;
  impacta_aulas: boolean;
  bloqueia_frequencia: boolean;
  observacoes: string;
};

export type EventoFormState =
  | {
      errors?: Partial<
        Record<
          | "nome"
          | "tipo"
          | "tipo_feriado"
          | "data_inicio"
          | "data_fim"
          | "abrangencia"
          | "curso_id"
          | "turma_id",
          string[]
        >
      >;
      error?: string;
      values?: EventoFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): EventoFormValuesEcho {
  return {
    nome: String(formData.get("nome") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    tipo_feriado: String(formData.get("tipo_feriado") ?? ""),
    data_inicio: String(formData.get("data_inicio") ?? ""),
    data_fim: String(formData.get("data_fim") ?? ""),
    horario_inicio: String(formData.get("horario_inicio") ?? ""),
    horario_fim: String(formData.get("horario_fim") ?? ""),
    abrangencia: String(formData.get("abrangencia") ?? ""),
    curso_id: String(formData.get("curso_id") ?? ""),
    turma_id: String(formData.get("turma_id") ?? ""),
    gera_notificacao: formData.get("gera_notificacao") === "on",
    impacta_aulas: formData.get("impacta_aulas") === "on",
    bloqueia_frequencia: formData.get("bloqueia_frequencia") === "on",
    observacoes: String(formData.get("observacoes") ?? ""),
  };
}

function parseEventoForm(formData: FormData) {
  return eventoFormSchema.safeParse({
    nome: formData.get("nome"),
    tipo: formData.get("tipo"),
    tipo_feriado: formData.get("tipo_feriado") || undefined,
    data_inicio: formData.get("data_inicio"),
    data_fim: formData.get("data_fim") || undefined,
    horario_inicio: formData.get("horario_inicio") || undefined,
    horario_fim: formData.get("horario_fim") || undefined,
    abrangencia: formData.get("abrangencia"),
    curso_id: formData.get("curso_id") || undefined,
    turma_id: formData.get("turma_id") || undefined,
    gera_notificacao: formData.get("gera_notificacao") === "on",
    impacta_aulas: formData.get("impacta_aulas") === "on",
    bloqueia_frequencia: formData.get("bloqueia_frequencia") === "on",
    observacoes: formData.get("observacoes") || undefined,
  });
}

export async function createEvento(
  _prevState: EventoFormState,
  formData: FormData,
): Promise<EventoFormState> {
  await requireRole("admin");

  const parsed = parseEventoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("eventos_calendario").insert({
    nome: data.nome,
    tipo: data.tipo,
    tipo_feriado: data.tipo === "feriado" ? (data.tipo_feriado ?? null) : null,
    data_inicio: data.data_inicio,
    // Sem data de término informada, assume a mesma data de início.
    data_fim: data.data_fim ?? data.data_inicio,
    horario_inicio: data.horario_inicio ?? null,
    horario_fim: data.horario_fim ?? null,
    curso_id: data.abrangencia === "curso" ? (data.curso_id ?? null) : null,
    turma_id: data.abrangencia === "turma" ? (data.turma_id ?? null) : null,
    abrangencia: data.abrangencia,
    gera_notificacao: data.gera_notificacao,
    impacta_aulas: data.impacta_aulas,
    bloqueia_frequencia: data.bloqueia_frequencia,
    observacoes: data.observacoes ?? null,
    origem: "manual",
  });

  if (error) {
    return {
      error: "Não foi possível criar o evento. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/calendario");
  redirect("/admin/calendario");
}

export async function deleteEvento(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("eventos_calendario").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o evento. Tente novamente." };
  }

  revalidatePath("/admin/calendario");
  return {};
}

export type SincronizarFeriadosResult =
  | { success: true; quantidade: number }
  | { success: false; error: string };

export async function sincronizarFeriadosAction(ano: number): Promise<SincronizarFeriadosResult> {
  await requireRole("admin");

  try {
    const quantidade = await sincronizarFeriados(ano);
    revalidatePath("/admin/calendario");
    return { success: true, quantidade };
  } catch {
    return {
      success: false,
      error: "Não foi possível sincronizar os feriados. Tente novamente.",
    };
  }
}

export type EnviarAvisoFeriadoResult = { enviadas: number; erros: number };

type LinhaMatriculaAtiva = {
  aluno_id: string;
  alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null;
};

// Mensagem manual em massa pra todo aluno com matrícula ativa, disparada do dialog de evento do
// calendário (botão "Enviar para todos os alunos", só quando o evento é um feriado). Dedup por
// aluno_id: um aluno com mais de uma matrícula ativa não recebe a mensagem repetida. Sequencial
// de propósito (for...of com await, não Promise.all) — mesmo padrão dos outros envios em massa
// deste projeto, enviarWhatsApp já embute o delay anti-banimento.
export async function enviarAvisoFeriadoAction(
  eventoId: string,
  nomeEvento: string,
  mensagem: string,
): Promise<EnviarAvisoFeriadoResult> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("matriculas")
    .select("aluno_id, alunos(telefone, profiles!alunos_id_fkey(full_name))")
    .eq("status", "ativa");

  if (error || !data) {
    console.error("[enviarAvisoFeriadoAction]", error);
    return { enviadas: 0, erros: 0 };
  }

  const vistos = new Set<string>();
  let enviadas = 0;
  let erros = 0;
  for (const matricula of data as unknown as LinhaMatriculaAtiva[]) {
    if (vistos.has(matricula.aluno_id)) continue;
    vistos.add(matricula.aluno_id);

    const telefone = matricula.alunos?.telefone;
    if (!telefone) {
      erros++;
      continue;
    }

    const nome = matricula.alunos?.profiles?.full_name ?? "aluno(a)";
    const texto = mensagem.replaceAll("{nome}", nome).replaceAll("{feriado}", nomeEvento);

    const resultado = await enviarWhatsApp(telefone, texto);
    if (resultado.ok && resultado.enviado) enviadas++;
    else erros++;
  }

  return { enviadas, erros };
}
