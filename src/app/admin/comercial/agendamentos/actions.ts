"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  getAgendamentoPaginasAdmin,
  getAgendamentos as getAgendamentosLib,
  type AgendamentoPaginaComContagem,
} from "@/lib/agendamentos/agendamentos";
import {
  agendamentoPaginaFormSchema,
  AGENDAMENTO_STATUSES,
  type Agendamento,
  type AgendamentoStatus,
} from "@/lib/agendamentos/schema";

export async function getAgendamentoPaginas(): Promise<AgendamentoPaginaComContagem[]> {
  await requireRole("admin");
  const supabase = await createClient();
  return getAgendamentoPaginasAdmin(supabase);
}

function parseAgendamentoPaginaForm(formData: FormData) {
  const horariosRaw = formData.get("horarios_disponiveis");
  const camposRaw = formData.get("campos_extras");

  return agendamentoPaginaFormSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug"),
    descricao: formData.get("descricao") || undefined,
    cor_primaria: formData.get("cor_primaria"),
    data_inicio: formData.get("data_inicio") || undefined,
    data_fim: formData.get("data_fim") || undefined,
    vagas_por_horario: formData.get("vagas_por_horario"),
    duracao_minutos: formData.get("duracao_minutos"),
    dias_antecedencia_minimo: formData.get("dias_antecedencia_minimo"),
    mensagem_confirmacao: formData.get("mensagem_confirmacao") || undefined,
    horarios_disponiveis: horariosRaw ? JSON.parse(String(horariosRaw)) : [],
    campos_extras: camposRaw ? JSON.parse(String(camposRaw)) : [],
  });
}

export async function criarAgendamentoPagina(formData: FormData): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("admin");

  const parsed = parseAgendamentoPaginaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agendamento_paginas")
    .insert({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      descricao: parsed.data.descricao ?? null,
      cor_primaria: parsed.data.cor_primaria,
      data_inicio: parsed.data.data_inicio ?? null,
      data_fim: parsed.data.data_fim ?? null,
      vagas_por_horario: parsed.data.vagas_por_horario,
      duracao_minutos: parsed.data.duracao_minutos,
      dias_antecedencia_minimo: parsed.data.dias_antecedencia_minimo,
      mensagem_confirmacao: parsed.data.mensagem_confirmacao ?? null,
      horarios_disponiveis: parsed.data.horarios_disponiveis,
      campos_extras: parsed.data.campos_extras,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    const mensagem = error?.code === "23505" ? "Já existe uma página com esse slug." : "Não foi possível criar a página.";
    return { error: mensagem };
  }

  revalidatePath("/admin/comercial/agendamentos");
  return { id: data.id };
}

export async function atualizarAgendamentoPagina(id: string, formData: FormData): Promise<{ error?: string; id?: string }> {
  await requireRole("admin");

  const parsed = parseAgendamentoPaginaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamento_paginas")
    .update({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      descricao: parsed.data.descricao ?? null,
      cor_primaria: parsed.data.cor_primaria,
      data_inicio: parsed.data.data_inicio ?? null,
      data_fim: parsed.data.data_fim ?? null,
      vagas_por_horario: parsed.data.vagas_por_horario,
      duracao_minutos: parsed.data.duracao_minutos,
      dias_antecedencia_minimo: parsed.data.dias_antecedencia_minimo,
      mensagem_confirmacao: parsed.data.mensagem_confirmacao ?? null,
      horarios_disponiveis: parsed.data.horarios_disponiveis,
      campos_extras: parsed.data.campos_extras,
    })
    .eq("id", id);

  if (error) {
    const mensagem = error.code === "23505" ? "Já existe uma página com esse slug." : "Não foi possível salvar as alterações.";
    return { error: mensagem };
  }

  revalidatePath("/admin/comercial/agendamentos");
  return { id };
}

export async function alternarStatusPagina(id: string, ativa: boolean): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamento_paginas")
    .update({ status: ativa ? "ativa" : "inativa" })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível alterar o status." };
  }

  revalidatePath("/admin/comercial/agendamentos");
  return {};
}

export async function getAgendamentos(
  paginaId: string,
  filtros?: { data?: string; status?: AgendamentoStatus },
): Promise<Agendamento[]> {
  await requireRole("admin");
  const supabase = await createClient();
  return getAgendamentosLib(supabase, paginaId, filtros);
}

export async function atualizarStatusAgendamento(id: string, status: string): Promise<{ error?: string }> {
  await requireRole("admin");

  if (!AGENDAMENTO_STATUSES.includes(status as AgendamentoStatus)) {
    return { error: "Status inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar o status." };
  }

  revalidatePath("/admin/comercial/agendamentos");
  return {};
}
