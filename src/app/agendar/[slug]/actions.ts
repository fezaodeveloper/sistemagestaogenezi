"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import {
  contarVagasOcupadasNoSlot,
  getAgendamentoPaginaPublica,
  validarSlotPermitido,
} from "@/lib/agendamentos/agendamentos";
import { agendamentoPublicoSchema } from "@/lib/agendamentos/schema";

export type CriarAgendamentoResultado = { success: true } | { error: string };

// Sem requireRole de propósito — é a única Server Action do módulo
// genuinamente alcançável por um visitante sem conta (mesmo espírito de
// criarOuAtualizarLeadPublico em src/lib/leads/leads.ts). Roda com o client
// admin (service_role) pra poder reconferir a vaga no exato momento do
// insert, sem depender da policy pública de select em `agendamentos` (que
// foi removida por segurança — ver migration).
export async function criarAgendamentoPublico(slug: string, formData: FormData): Promise<CriarAgendamentoResultado> {
  const camposExtrasRaw = formData.get("campos_extras");

  const parsed = agendamentoPublicoSchema.safeParse({
    nome: formData.get("nome"),
    whatsapp: formData.get("whatsapp"),
    data_agendada: formData.get("data_agendada"),
    horario: formData.get("horario"),
    campos_extras: camposExtrasRaw ? JSON.parse(String(camposExtrasRaw)) : undefined,
    aceite_whatsapp: formData.get("aceite_whatsapp") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const pagina = await getAgendamentoPaginaPublica(supabase, slug);
  if (!pagina) {
    return { error: "Página de agendamento não encontrada." };
  }

  if (!validarSlotPermitido(pagina, parsed.data.data_agendada, parsed.data.horario)) {
    return { error: "Esse horário não está mais disponível. Escolha outra data ou horário." };
  }

  const admin = createAdminClient();
  const ocupadas = await contarVagasOcupadasNoSlot(admin, pagina.id, parsed.data.data_agendada, parsed.data.horario);
  if (ocupadas >= pagina.vagas_por_horario) {
    return { error: "Esse horário acabou de lotar. Escolha outra data ou horário." };
  }

  const { data: agendamento, error } = await admin
    .from("agendamentos")
    .insert({
      pagina_id: pagina.id,
      nome: parsed.data.nome,
      whatsapp: parsed.data.whatsapp,
      data_agendada: parsed.data.data_agendada,
      horario: parsed.data.horario,
      campos_extras: parsed.data.campos_extras ?? {},
    })
    .select("id")
    .single();

  if (error || !agendamento) {
    return { error: "Não foi possível confirmar o agendamento. Tente novamente." };
  }

  // Stub — Evolution API virá depois.
  console.log(
    `[agendamentos] Enviaria confirmação por WhatsApp para ${parsed.data.nome} (${parsed.data.whatsapp}): ` +
      `agendado para ${parsed.data.data_agendada} às ${parsed.data.horario}`,
  );

  try {
    await dispararEvento(
      "agendamento.criado",
      {
        nome: parsed.data.nome,
        whatsapp: parsed.data.whatsapp,
        data_agendada: parsed.data.data_agendada,
        horario: parsed.data.horario,
        titulo_pagina: pagina.titulo,
      },
      `agendamento-criado-${agendamento.id}`,
    );
  } catch {
    // Best-effort — o agendamento já foi confirmado com sucesso acima.
  }

  return { success: true };
}
