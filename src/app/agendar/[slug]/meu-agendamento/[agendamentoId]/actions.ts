"use server";

// TAREFA agendamentos 2.4 (PARTE 4) — autoatendimento do cliente: cancelar ou remarcar o próprio
// agendamento, sem login. O UUID do agendamento (parte da URL) funciona como "token" de acesso —
// por isso toda função aqui recebe agendamentoId+slug e reconfirma a dupla antes de qualquer
// leitura/escrita (getAgendamentoComPaginaPublico), nunca aceita o id sozinho.

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  contarVagasOcupadasNoSlot,
  getAgendamentoComPaginaPublico,
  getHorariosOcupadosPorDia,
  validarSlotPermitido,
} from "@/lib/agendamentos/agendamentos";
import { expandirHorariosDisponiveis, horarioBloqueadoPorIntervalo } from "@/lib/agendamentos/schema";
import { registrarHistoricoLead } from "@/lib/leads/leads";
import { notificarWhatsappAgendamentoCancelado } from "@/lib/whatsapp/eventos";
import { dispararFluxosPorGatilho } from "@/lib/whatsapp/fluxos";

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const uuid = z.uuid();

export async function cancelarAgendamentoCliente(
  agendamentoId: string,
  slug: string,
  motivo?: string,
): Promise<{ error?: string }> {
  if (!uuid.safeParse(agendamentoId).success) return { error: "Agendamento inválido." };

  const encontrado = await getAgendamentoComPaginaPublico(agendamentoId, slug);
  if (!encontrado) return { error: "Agendamento não encontrado." };
  if (encontrado.agendamento.status !== "confirmado") {
    return { error: "Este agendamento já não está mais confirmado." };
  }

  const admin = createAdminClient();
  let { error } = await admin
    .from("agendamentos")
    .update({ status: "cancelado", cancelado_por: "cliente", motivo_cancelamento: motivo?.trim() || null })
    .eq("id", agendamentoId)
    .eq("status", "confirmado");

  // cancelado_por (migration 20261030500000) pode ainda não existir.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await admin
      .from("agendamentos")
      .update({ status: "cancelado", motivo_cancelamento: motivo?.trim() || null })
      .eq("id", agendamentoId)
      .eq("status", "confirmado"));
  }
  if (error) return { error: "Não foi possível cancelar. Tente novamente." };

  notificarWhatsappAgendamentoCancelado(agendamentoId, motivo);

  if (encontrado.agendamento.lead_id) {
    await registrarHistoricoLead(admin, encontrado.agendamento.lead_id, "agendamento", "Agendamento cancelado pelo próprio cliente");
  }

  return {};
}

export type HorarioRemarcacao = { horario: string; vagasRestantes: number };

export async function getHorariosParaRemarcacaoPublica(
  agendamentoId: string,
  slug: string,
  dataISO: string,
): Promise<HorarioRemarcacao[]> {
  if (!uuid.safeParse(agendamentoId).success || !DATA_ISO_REGEX.test(dataISO)) return [];

  const encontrado = await getAgendamentoComPaginaPublico(agendamentoId, slug);
  if (!encontrado) return [];
  const { pagina } = encontrado;

  const diaSemana = new Date(`${dataISO}T00:00:00`).getDay();
  const expandidos = expandirHorariosDisponiveis(pagina.horarios_disponiveis, pagina.duracao_minutos, pagina.intervalo_entre_horarios ?? 0);
  const candidatos = [...new Set(expandidos.filter((h) => h.dia_semana === diaSemana).map((h) => h.horario))]
    .filter((horario) => validarSlotPermitido(pagina, dataISO, horario))
    .sort();
  if (candidatos.length === 0) return [];

  const [contagem, ocupadosPorDia] = await Promise.all([
    (async () => {
      const admin = createAdminClient();
      const contagemPorChave: Record<string, number> = {};
      await Promise.all(
        candidatos.map(async (horario) => {
          contagemPorChave[`${dataISO}_${horario}`] = await contarVagasOcupadasNoSlot(admin, pagina.id, dataISO, horario);
        }),
      );
      return contagemPorChave;
    })(),
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

const remarcarSchema = z.object({
  data: z.string().regex(DATA_ISO_REGEX),
  horario: z.string().regex(HORARIO_REGEX),
});

// Cria um NOVO agendamento (remarcado_de = o atual) e cancela o atual — mesmo critério do
// reagendamento do admin (reagendarAgendamento), mas aqui preserva o histórico em vez de
// sobrescrever a mesma linha, porque o link de autoatendimento que o cliente já tem continua
// válido só pro agendamento ANTIGO (cancelado); o novo precisa de um link novo.
export async function remarcarAgendamentoCliente(
  agendamentoId: string,
  slug: string,
  dataISO: string,
  horario: string,
): Promise<{ novoAgendamentoId: string } | { error: string }> {
  if (!uuid.safeParse(agendamentoId).success) return { error: "Agendamento inválido." };
  const parsed = remarcarSchema.safeParse({ data: dataISO, horario });
  if (!parsed.success) return { error: "Data ou horário inválido." };

  const encontrado = await getAgendamentoComPaginaPublico(agendamentoId, slug);
  if (!encontrado) return { error: "Agendamento não encontrado." };
  const { agendamento, pagina } = encontrado;
  if (agendamento.status !== "confirmado") return { error: "Este agendamento já não está mais confirmado." };

  if (!validarSlotPermitido(pagina, parsed.data.data, parsed.data.horario)) {
    return { error: "Esse horário não está disponível." };
  }

  const admin = createAdminClient();
  const ocupadas = await contarVagasOcupadasNoSlot(admin, pagina.id, parsed.data.data, parsed.data.horario);
  if (ocupadas >= pagina.vagas_por_horario) {
    return { error: "Esse horário acabou de lotar. Escolha outro." };
  }
  if ((pagina.intervalo_entre_horarios ?? 0) > 0) {
    const ocupadosPorDia = await getHorariosOcupadosPorDia(pagina.id, parsed.data.data, parsed.data.data);
    const horariosDoDia = ocupadosPorDia[parsed.data.data] ?? [];
    if (horarioBloqueadoPorIntervalo(parsed.data.horario, horariosDoDia, pagina.duracao_minutos, pagina.intervalo_entre_horarios ?? 0)) {
      return { error: "Esse horário ficou muito próximo de outro já agendado. Escolha outro." };
    }
  }

  const dadosBase = {
    pagina_id: pagina.id,
    nome: agendamento.nome,
    whatsapp: agendamento.whatsapp,
    data_agendada: parsed.data.data,
    horario: parsed.data.horario,
    campos_extras: agendamento.campos_extras ?? {},
    lead_id: agendamento.lead_id ?? null,
    status: "confirmado",
  };

  let { data: novo, error: erroInsercao } = await admin
    .from("agendamentos")
    .insert({ ...dadosBase, email: agendamento.email ?? null, remarcado_de: agendamento.id })
    .select("id")
    .single();

  // email/remarcado_de (migration 20261030500000) podem ainda não existir — nunca pode impedir
  // a remarcação por causa disso (mesmo padrão defensivo de agendar/[slug]/actions.ts).
  if (erroInsercao && (erroInsercao.code === "42703" || erroInsercao.code === "PGRST204")) {
    ({ data: novo, error: erroInsercao } = await admin.from("agendamentos").insert(dadosBase).select("id").single());
  }
  if (erroInsercao || !novo) return { error: "Não foi possível remarcar. Tente novamente." };

  await admin
    .from("agendamentos")
    .update({ status: "cancelado", cancelado_por: "cliente", motivo_cancelamento: "Remarcado pelo cliente" })
    .eq("id", agendamento.id);

  if (agendamento.lead_id) {
    await registrarHistoricoLead(
      admin,
      agendamento.lead_id,
      "agendamento",
      `Agendamento remarcado pelo cliente para ${parsed.data.data} às ${parsed.data.horario}`,
    );
  }

  dispararFluxosPorGatilho(
    "agendamento_criado",
    {
      telefone: agendamento.whatsapp,
      nome: agendamento.nome,
      data: parsed.data.data,
      horario: parsed.data.horario,
      titulo_pagina: pagina.titulo,
    },
    { tipo: "agendamento", id: novo.id as string },
  );

  return { novoAgendamentoId: novo.id as string };
}
