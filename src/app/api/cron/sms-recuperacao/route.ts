import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarConfigSms } from "@/lib/integrax/config";
import { nomeEscolaParaSms } from "@/lib/integrax/modelos";
import { primeiroNomeSms } from "@/lib/integrax/notificacoes";
import { enviarSMS, normalizarTelefoneSms } from "@/lib/integrax/sms";
import { RECUPERACAO_ENCURTAVEIS, renderizarSms } from "@/lib/integrax/templates";
import {
  RECUPERACAO_CONFIG_ID,
  RECUPERACAO_FOLGA_CRON_HORAS,
  lerEtapas,
} from "@/lib/integrax/recuperacao";

// Recuperação escalonada por SMS (Configurações > Apps > IntegraX > Recuperação Escalonada):
// sequência automática de mensagens para LEADS que se cadastraram e ainda não se matricularam.
//
// Roda 1x por dia (plano Hobby — ver vercel.json). Por isso, se num mesmo dia um lead já passou
// por mais de uma etapa (ex.: cadastrado há 30h com etapas de 3h e 24h), envia SÓ a mais avançada
// e marca as anteriores como "ignorada" no log — nunca manda várias mensagens de uma vez.
//
// Controle de envio: sms_recuperacao_log tem unique(lead_id, etapa_index). A etapa é RESERVADA
// (insert) antes do envio; se o envio falha a reserva é apagada e a etapa tenta de novo na próxima
// execução (enquanto o lead estiver no prazo).
export const maxDuration = 60;

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";
const MAX_LEADS_POR_EXECUCAO = 1000;
const MAX_ENVIOS_POR_EXECUCAO = 150;
// Deixa folga pro resto da função dentro do maxDuration.
const ORCAMENTO_MS = 50_000;
const LOTE_CONSULTA_LOG = 100;

type LeadCandidato = {
  id: string;
  nome: string;
  telefone: string;
  created_at: string;
  cursos: { nome: string } | null;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function urlBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

// Link do {link_agendamento}: a página pública de agendamento ativa mais recente (dentro do
// período configurado); senão o site da escola; senão o endereço do sistema.
async function resolverLinkAgendamento(admin: SupabaseAdmin): Promise<string> {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: paginas } = await admin
      .from("agendamento_paginas")
      .select("slug, data_inicio, data_fim")
      .eq("status", "ativa")
      .order("created_at", { ascending: false })
      .limit(10);
    const pagina = ((paginas ?? []) as { slug: string; data_inicio: string | null; data_fim: string | null }[]).find(
      (p) => (!p.data_inicio || p.data_inicio <= hoje) && (!p.data_fim || p.data_fim >= hoje),
    );
    if (pagina) return `${urlBase()}/agendar/${pagina.slug}`;

    const { data: config } = await admin.from("configuracoes").select("escola_site").eq("id", true).maybeSingle();
    const site = (config?.escola_site as string | null | undefined)?.trim();
    if (site) return /^https?:\/\//i.test(site) ? site : `https://${site}`;
  } catch {
    // Cai no endereço do sistema.
  }
  return urlBase();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inicio = Date.now();
  const admin = createAdminClient();

  const { data: config, error: erroConfig } = await admin
    .from("sms_recuperacao_config")
    .select("ativo, prazo_maximo_horas, etapas, ativado_em")
    .eq("id", RECUPERACAO_CONFIG_ID)
    .maybeSingle();
  if (erroConfig || !config) return NextResponse.json({ ignorado: "configuração da recuperação indisponível (migration aplicada?)" });
  if (config.ativo !== true) return NextResponse.json({ ignorado: "recuperação desativada" });

  // Com a integração desligada o enviarSMS só faz "stub" (ok, mas nada enviado): não pode gastar
  // as etapas — elas ficam pendentes até a IntegraX ser ativada.
  const sms = await carregarConfigSms();
  if (!sms.token || !sms.ativo) return NextResponse.json({ ignorado: "integração IntegraX desativada ou sem token" });

  const prazoHoras = Number(config.prazo_maximo_horas) || 48;
  const etapas = lerEtapas(config.etapas)
    .filter((e) => e.horas <= prazoHoras)
    .map((etapa, index) => ({ ...etapa, index }));
  if (etapas.length === 0) return NextResponse.json({ ignorado: "nenhuma etapa configurada dentro do prazo" });

  // Leads criados dentro do prazo (+ folga do cron diário) E depois de a recuperação ser ligada.
  const agora = Date.now();
  let desdeMs = agora - (prazoHoras + RECUPERACAO_FOLGA_CRON_HORAS) * 3_600_000;
  if (config.ativado_em) desdeMs = Math.max(desdeMs, new Date(config.ativado_em as string).getTime());

  // Ainda não virou matrícula: status novo/contatado (o de "aluno_ativo/ex_aluno/desistente" é
  // sincronizado por trigger quando o telefone+curso bate com uma matrícula) e fora das colunas
  // encerradas do Kanban (matriculado/perdido).
  const { data: leadsData, error: erroLeads } = await admin
    .from("leads")
    .select("id, nome, telefone, created_at, cursos(nome)")
    .gte("created_at", new Date(desdeMs).toISOString())
    .in("status", ["novo", "contatado"])
    .not("kanban_coluna", "in", "(matriculado,perdido)")
    .order("created_at", { ascending: true })
    .limit(MAX_LEADS_POR_EXECUCAO);
  if (erroLeads) return NextResponse.json({ error: "não foi possível consultar os leads" }, { status: 500 });

  const leads = (leadsData ?? []) as unknown as LeadCandidato[];
  if (leads.length === 0) return NextResponse.json({ elegiveis: 0, enviados: 0, ignoradas: 0, falhas: 0 });

  // Etapas já tratadas (enviadas OU ignoradas) por lead — em lotes (URL do filtro `in`).
  const jaTratadas = new Map<string, Set<number>>();
  for (let i = 0; i < leads.length; i += LOTE_CONSULTA_LOG) {
    const ids = leads.slice(i, i + LOTE_CONSULTA_LOG).map((l) => l.id);
    const { data: logs } = await admin.from("sms_recuperacao_log").select("lead_id, etapa_index").in("lead_id", ids);
    for (const log of (logs ?? []) as { lead_id: string; etapa_index: number }[]) {
      if (!jaTratadas.has(log.lead_id)) jaTratadas.set(log.lead_id, new Set());
      jaTratadas.get(log.lead_id)!.add(log.etapa_index);
    }
  }

  const [linkAgendamento, nomeEscola] = await Promise.all([resolverLinkAgendamento(admin), nomeEscolaParaSms()]);

  let enviados = 0;
  let ignoradas = 0;
  let falhas = 0;
  let semTelefone = 0;
  const telefonesDaExecucao = new Set<string>();

  for (const lead of leads) {
    if (enviados >= MAX_ENVIOS_POR_EXECUCAO || Date.now() - inicio > ORCAMENTO_MS) break;

    const telefone = normalizarTelefoneSms(lead.telefone);
    if (!telefone) {
      semTelefone += 1;
      continue;
    }

    const decorridoHoras = (agora - new Date(lead.created_at).getTime()) / 3_600_000;
    const tratadas = jaTratadas.get(lead.id) ?? new Set<number>();
    const vencidas = etapas.filter((e) => e.horas <= decorridoHoras && !tratadas.has(e.index));
    if (vencidas.length === 0) continue;

    // Uma pessoa com dois leads abertos recebe no máximo 1 SMS por execução.
    if (telefonesDaExecucao.has(telefone)) continue;

    const alvo = vencidas[vencidas.length - 1];
    const substituidas = vencidas.slice(0, -1);

    // Reserva a etapa ANTES de enviar (unique lead_id+etapa_index): duas execuções simultâneas
    // nunca mandam o mesmo SMS duas vezes.
    const { error: erroReserva } = await admin
      .from("sms_recuperacao_log")
      .insert({ lead_id: lead.id, etapa_index: alvo.index, status: "enviado" });
    if (erroReserva) continue; // 23505 = outra execução já pegou; qualquer outro erro: tenta amanhã.

    if (substituidas.length > 0) {
      await admin.from("sms_recuperacao_log").upsert(
        substituidas.map((e) => ({ lead_id: lead.id, etapa_index: e.index, status: "ignorada" })),
        { onConflict: "lead_id,etapa_index", ignoreDuplicates: true },
      );
    }

    const mensagem = renderizarSms(
      alvo.mensagem,
      {
        nome_cliente: primeiroNomeSms(lead.nome),
        nome_escola: nomeEscola,
        curso_interesse: lead.cursos?.nome ?? "nossos cursos",
        link_agendamento: linkAgendamento,
      },
      RECUPERACAO_ENCURTAVEIS,
    );

    const resultado = await enviarSMS(lead.telefone, mensagem);
    if (!resultado.ok || !resultado.enviado) {
      // Falhou (ou nada foi enviado): libera a reserva pra tentar de novo na próxima execução.
      await admin.from("sms_recuperacao_log").delete().eq("lead_id", lead.id).eq("etapa_index", alvo.index);
      falhas += 1;
      console.error(`[sms-recuperacao] falha ao enviar (lead ${lead.id}, etapa ${alvo.index}): ${resultado.erro ?? "não enviado"}`);
      continue;
    }

    telefonesDaExecucao.add(telefone);
    enviados += 1;
    ignoradas += substituidas.length;
  }

  return NextResponse.json({ elegiveis: leads.length, enviados, ignoradas, falhas, semTelefone });
}
