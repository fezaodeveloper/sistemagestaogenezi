"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  contarVagasOcupadasNoSlot,
  getAgendamentoPagina,
  getAgendamentoPaginasAdmin,
  getAgendamentos as getAgendamentosLib,
  getContagemPorHorario,
  validarSlotPermitido,
  type AgendamentoPaginaComContagem,
} from "@/lib/agendamentos/agendamentos";
import {
  agendamentoPaginaFormSchema,
  AGENDAMENTO_STATUSES,
  type Agendamento,
  type AgendamentoStatus,
} from "@/lib/agendamentos/schema";

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG_MAXIMO = 100;
const TENTATIVAS_SLUG_COPIA = 20;

// A listagem de páginas fica em /admin/comercial/agendamentos; o Kanban de
// cada página em /admin/comercial/agendamentos/[id] — rota dinâmica que o
// revalidatePath do path pai não alcança.
function revalidarAgendamentos() {
  revalidatePath("/admin/comercial/agendamentos");
  revalidatePath("/admin/comercial/agendamentos/[id]", "page");
}

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
    const mensagem =
      error?.code === "23505"
        ? "Já existe uma página com esse slug."
        : "Não foi possível criar a página. Tente novamente.";
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

  revalidarAgendamentos();
  return {};
}

// Duplica a página copiando todos os campos, exceto o slug (que ganha o
// sufixo "-copia", ou "-copia-2", "-copia-3"... se já existir). Nasce
// `inativa` — mesmo critério de duplicarCampanhaPagina: uma cópia idêntica de
// uma página pública ativa não deve ir ao ar sozinha, antes do admin ajustar.
export async function duplicarAgendamentoPagina(id: string): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const original = await getAgendamentoPagina(supabase, id);
  if (!original) {
    return { error: "Página não encontrada." };
  }

  for (let tentativa = 1; tentativa <= TENTATIVAS_SLUG_COPIA; tentativa++) {
    const sufixo = tentativa === 1 ? "-copia" : `-copia-${tentativa}`;
    // Corta o slug original pra sufixo caber no limite (e tira hífen sobrando
    // no fim, que geraria "--" e violaria o formato de slug).
    const slug = `${original.slug.slice(0, SLUG_MAXIMO - sufixo.length).replace(/-+$/, "")}${sufixo}`;

    const { data, error } = await supabase
      .from("agendamento_paginas")
      .insert({
        titulo: `${original.titulo} (cópia)`,
        slug,
        descricao: original.descricao,
        cor_primaria: original.cor_primaria,
        logo_url: original.logo_url,
        status: "inativa",
        data_inicio: original.data_inicio,
        data_fim: original.data_fim,
        vagas_por_horario: original.vagas_por_horario,
        duracao_minutos: original.duracao_minutos,
        horarios_disponiveis: original.horarios_disponiveis,
        dias_antecedencia_minimo: original.dias_antecedencia_minimo,
        campos_extras: original.campos_extras,
        mensagem_confirmacao: original.mensagem_confirmacao,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error?.code === "23505") continue; // slug já existe — tenta o próximo sufixo
    if (error || !data) {
      return { error: "Não foi possível duplicar a página. Tente novamente." };
    }

    revalidarAgendamentos();
    return { id: data.id };
  }

  return { error: "Não foi possível gerar um slug único para a cópia." };
}

// Os agendamentos da página são excluídos junto (FK on delete cascade).
export async function excluirAgendamentoPagina(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase.from("agendamento_paginas").delete().eq("id", id).select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível excluir a página. Tente novamente." };
  }

  revalidarAgendamentos();
  return {};
}

export async function excluirAgendamento(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase.from("agendamentos").delete().eq("id", id).select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível excluir o agendamento. Tente novamente." };
  }

  revalidarAgendamentos();
  return {};
}

export type HorarioReagendamento = { horario: string; vagasRestantes: number };

// Horários que ainda dá pra escolher numa data (dialog "Reagendar"): mesmas
// regras da página pública — dia da semana configurado, dentro do período e
// da antecedência mínima (validarSlotPermitido) — e com a vaga descontada
// pela contagem de agendamentos confirmados naquele slot.
export async function getHorariosDisponiveisReagendamento(
  paginaId: string,
  dataISO: string,
): Promise<HorarioReagendamento[]> {
  await requireRole("admin");
  if (!DATA_ISO_REGEX.test(dataISO)) return [];

  const supabase = await createClient();
  const pagina = await getAgendamentoPagina(supabase, paginaId);
  if (!pagina) return [];

  const diaSemana = new Date(`${dataISO}T00:00:00`).getDay();
  const candidatos = [
    ...new Set(pagina.horarios_disponiveis.filter((h) => h.dia_semana === diaSemana).map((h) => h.horario)),
  ]
    .filter((horario) => validarSlotPermitido(pagina, dataISO, horario))
    .sort();
  if (candidatos.length === 0) return [];

  const contagem = await getContagemPorHorario(pagina.id, dataISO, dataISO);
  return candidatos.map((horario) => ({
    horario,
    vagasRestantes: Math.max(0, pagina.vagas_por_horario - (contagem[`${dataISO}_${horario}`] ?? 0)),
  }));
}

const reagendarSchema = z.object({
  id: z.uuid(),
  data: z.string().regex(DATA_ISO_REGEX),
  horario: z.string().regex(HORARIO_REGEX),
});

// Reagendar: grava a nova data/horário e devolve o agendamento pra coluna
// "Agendado" (status confirmado). Revalida o slot no servidor — a UI só
// lista horários livres, mas a action é alcançável por POST direto e a vaga
// pode ter lotado entre abrir o dialog e confirmar.
export async function reagendarAgendamento(id: string, dataISO: string, horario: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = reagendarSchema.safeParse({ id, data: dataISO, horario });
  if (!parsed.success) {
    return { error: "Data ou horário inválido." };
  }

  const supabase = await createClient();
  const { data: agendamento } = await supabase
    .from("agendamentos")
    .select("id, pagina_id, nome, whatsapp")
    .eq("id", id)
    .maybeSingle();
  if (!agendamento) {
    return { error: "Agendamento não encontrado." };
  }

  const pagina = await getAgendamentoPagina(supabase, agendamento.pagina_id);
  if (!pagina) {
    return { error: "Página de agendamento não encontrada." };
  }

  if (!validarSlotPermitido(pagina, dataISO, horario)) {
    return { error: "Esse horário não está disponível para agendamento." };
  }

  const ocupadas = await contarVagasOcupadasNoSlot(createAdminClient(), pagina.id, dataISO, horario);
  if (ocupadas >= pagina.vagas_por_horario) {
    return { error: "Esse horário já está lotado. Escolha outro." };
  }

  const { error } = await supabase
    .from("agendamentos")
    .update({ data_agendada: dataISO, horario, status: "confirmado", lembrete_enviado: false })
    .eq("id", id);
  if (error) {
    return { error: "Não foi possível reagendar. Tente novamente." };
  }

  // Stub — Evolution API virá depois.
  const [ano, mes, dia] = dataISO.split("-");
  console.log(
    `[agendamentos] Enviaria mensagem de reagendamento por WhatsApp para ${agendamento.nome} (${agendamento.whatsapp}): ` +
      `"Olá, ${agendamento.nome}! Seu agendamento em "${pagina.titulo}" foi reagendado para ${dia}/${mes}/${ano} às ${horario}."`,
  );

  revalidarAgendamentos();
  return {};
}
