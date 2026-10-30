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
  getHorariosOcupadosPorDia,
  validarSlotPermitido,
  type AgendamentoPaginaComContagem,
} from "@/lib/agendamentos/agendamentos";
import {
  agendamentoPaginaFormSchema,
  AGENDAMENTO_STATUSES,
  horarioBloqueadoPorIntervalo,
  type Agendamento,
  type AgendamentoStatus,
  type ResponsavelOpcao,
} from "@/lib/agendamentos/schema";
import { ERRO_LOTE_INVALIDO, sanitizarIdsLote, type ResultadoExclusaoLote } from "@/lib/exclusao-em-lote";
import { notificarWhatsappAgendamentoCancelado, notificarWhatsappAgendamentoFalta } from "@/lib/whatsapp/eventos";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";

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
  const feriadosRaw = formData.get("feriados_bloqueados");
  const datasRaw = formData.get("datas_bloqueadas");

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
    antecedencia_maxima_dias: formData.get("antecedencia_maxima_dias"),
    intervalo_entre_horarios: formData.get("intervalo_entre_horarios"),
    mensagem_confirmacao: formData.get("mensagem_confirmacao") || undefined,
    horarios_disponiveis: horariosRaw ? JSON.parse(String(horariosRaw)) : [],
    campos_extras: camposRaw ? JSON.parse(String(camposRaw)) : [],
    local_atendimento: formData.get("local_atendimento") || undefined,
    responsavel_id: formData.get("responsavel_id") || "",
    feriados_bloqueados: feriadosRaw ? JSON.parse(String(feriadosRaw)) : [],
    datas_bloqueadas: datasRaw ? JSON.parse(String(datasRaw)) : [],
  });
}

// TAREFA agendamentos 2.4 (PARTE 2) — lista de admins pro <select> de "Responsável" na página de
// agendamento. is_admin() não filtra por nome, então a query vai direto na coluna role.
export async function getResponsaveisAdmin(): Promise<ResponsavelOpcao[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name");
  return (data ?? []) as ResponsavelOpcao[];
}

export async function criarAgendamentoPagina(formData: FormData): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("admin");

  const parsed = parseAgendamentoPaginaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const camposNovos = {
    antecedencia_maxima_dias: parsed.data.antecedencia_maxima_dias,
    intervalo_entre_horarios: parsed.data.intervalo_entre_horarios,
    local_atendimento: parsed.data.local_atendimento ?? null,
    responsavel_id: parsed.data.responsavel_id || null,
    feriados_bloqueados: parsed.data.feriados_bloqueados,
    datas_bloqueadas: parsed.data.datas_bloqueadas,
  };
  let { data, error } = await supabase
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
      ...camposNovos,
    })
    .select("id")
    .single();

  // Colunas novas (migration 20261030500000) podem ainda não existir — nunca pode impedir a
  // criação da página por causa disso (mesmo padrão defensivo já usado em agendar/[slug]/actions.ts).
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await supabase
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
      .single());
  }

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
  const camposBase = {
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
  };

  let { error } = await supabase
    .from("agendamento_paginas")
    .update({
      ...camposBase,
      antecedencia_maxima_dias: parsed.data.antecedencia_maxima_dias,
      intervalo_entre_horarios: parsed.data.intervalo_entre_horarios,
      local_atendimento: parsed.data.local_atendimento ?? null,
      responsavel_id: parsed.data.responsavel_id || null,
      feriados_bloqueados: parsed.data.feriados_bloqueados,
      datas_bloqueadas: parsed.data.datas_bloqueadas,
    })
    .eq("id", id);

  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("agendamento_paginas").update(camposBase).eq("id", id));
  }

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

export async function atualizarStatusAgendamento(id: string, status: string, motivo?: string): Promise<{ error?: string }> {
  await requireRole("admin");

  if (!AGENDAMENTO_STATUSES.includes(status as AgendamentoStatus)) {
    return { error: "Status inválido." };
  }

  const supabase = await createClient();
  const { data: antes } = await supabase.from("agendamentos").select("status").eq("id", id).maybeSingle();

  const atualizacao: { status: string; motivo_cancelamento?: string; cancelado_por?: string } = { status };
  if (status === "cancelado") {
    if (motivo) atualizacao.motivo_cancelamento = motivo;
    atualizacao.cancelado_por = "admin";
  }

  let { error } = await supabase.from("agendamentos").update(atualizacao).eq("id", id);

  // cancelado_por (migration 20261030500000) pode ainda não existir — nunca pode impedir o
  // cancelamento em si (mesmo padrão defensivo de agendar/[slug]/actions.ts pra colunas novas).
  if (error && atualizacao.cancelado_por && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase
      .from("agendamentos")
      .update({ status: atualizacao.status, motivo_cancelamento: atualizacao.motivo_cancelamento })
      .eq("id", id));
  }

  if (error) {
    return { error: "Não foi possível atualizar o status." };
  }

  // WhatsApp (GênZap/Evolution API) — só quando o status realmente MUDOU pra cancelado/faltou
  // agora (evita reenviar se o admin clicar duas vezes no mesmo status). Fire-and-forget: a
  // Server Action não espera o delay anti-banimento pra responder.
  if (antes && antes.status !== status) {
    if (status === "cancelado") notificarWhatsappAgendamentoCancelado(id, motivo);
    else if (status === "faltou") notificarWhatsappAgendamentoFalta(id);
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

    const camposDuplicados = {
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
    };
    let { data, error } = await supabase
      .from("agendamento_paginas")
      .insert({
        ...camposDuplicados,
        antecedencia_maxima_dias: original.antecedencia_maxima_dias,
        intervalo_entre_horarios: original.intervalo_entre_horarios,
        local_atendimento: original.local_atendimento,
        responsavel_id: original.responsavel_id,
        feriados_bloqueados: original.feriados_bloqueados,
        datas_bloqueadas: original.datas_bloqueadas,
      })
      .select("id")
      .single();

    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      ({ data, error } = await supabase.from("agendamento_paginas").insert(camposDuplicados).select("id").single());
    }

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

// Exclusão em lote (seleção múltipla na lista de agendamentos) — mesma regra de
// excluirAgendamento, num único delete.
export async function excluirAgendamentosEmLote(ids: string[]): Promise<ResultadoExclusaoLote> {
  await requireRole("admin");

  const validos = sanitizarIdsLote(ids);
  if (!validos) return { excluidos: 0, falhas: [], erro: ERRO_LOTE_INVALIDO };

  const supabase = await createClient();
  const { data } = await supabase.from("agendamentos").delete().in("id", validos).select("id");
  const apagados = new Set((data ?? []).map((linha) => linha.id as string));

  revalidarAgendamentos();
  return { excluidos: apagados.size, falhas: validos.filter((id) => !apagados.has(id)) };
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

  const [contagem, ocupadosPorDia] = await Promise.all([
    getContagemPorHorario(pagina.id, dataISO, dataISO),
    getHorariosOcupadosPorDia(pagina.id, dataISO, dataISO),
  ]);
  const ocupadosNoDia = ocupadosPorDia[dataISO] ?? [];
  return candidatos
    .filter((horario) => !horarioBloqueadoPorIntervalo(horario, ocupadosNoDia, pagina.duracao_minutos, pagina.intervalo_entre_horarios ?? 0))
    .map((horario) => ({
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

export type EnviarMensagemAgendadosResult = { enviadas: number; erros: number };

// Mensagem manual em massa pra todos os confirmados da página (botão "Enviar para todos" no
// Kanban). Usa createAdminClient (não createClient) pra buscar TODOS os confirmados sem
// paginação — getAgendamentos (acima) já faz isso sem .range(), mas aqui chama direto a tabela
// porque o resultado não precisa do tipo Agendamento completo, só dos campos usados na mensagem.
// Sequencial de propósito (for...of com await, não Promise.all): mesmo padrão dos outros envios
// em massa deste projeto — enviarWhatsApp já embute o delay anti-banimento.
export async function enviarMensagemAgendadosAction(
  paginaId: string,
  mensagem: string,
): Promise<EnviarMensagemAgendadosResult> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("agendamentos")
    .select("id, nome, whatsapp, data_agendada, horario")
    .eq("pagina_id", paginaId)
    .eq("status", "confirmado")
    .order("data_agendada", { ascending: true });

  if (error || !data) {
    console.error("[enviarMensagemAgendadosAction]", error);
    return { enviadas: 0, erros: 0 };
  }

  let enviadas = 0;
  let erros = 0;
  for (const ag of data as { id: string; nome: string; whatsapp: string; data_agendada: string; horario: string }[]) {
    const texto = mensagem
      .replaceAll("{nome}", ag.nome)
      .replaceAll("{data}", new Date(`${ag.data_agendada}T12:00:00`).toLocaleDateString("pt-BR"))
      .replaceAll("{horario}", ag.horario);

    const resultado = await enviarWhatsApp(ag.whatsapp, texto);
    if (resultado.ok && resultado.enviado) enviadas++;
    else erros++;
  }

  return { enviadas, erros };
}
