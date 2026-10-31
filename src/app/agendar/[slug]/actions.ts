"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { dispararWebhook } from "@/lib/webhooks/disparar";
import { notificarEmailAgendamento } from "@/lib/email/eventos";
import { dispararFluxosPorGatilho } from "@/lib/whatsapp/fluxos";
import {
  contarVagasOcupadasNoSlot,
  getAgendamentoPaginaPublica,
  getHorariosOcupadosPorDia,
  validarSlotPermitido,
} from "@/lib/agendamentos/agendamentos";
import { agendamentoPublicoSchema, horarioBloqueadoPorIntervalo } from "@/lib/agendamentos/schema";
import { encontrarLeadPorWhatsappOuEmail, getKanbanColunas, registrarHistoricoLead } from "@/lib/leads/leads";
import { encontrarColunaVisitaAgendado } from "@/lib/leads/schema";
import { notificarWhatsappAgendamentoConfirmacao } from "@/lib/whatsapp/eventos";

// slotIndisponivel: o horário escolhido não está mais disponível (lotou ou
// saiu das regras da página) — o client volta pro passo 1 e marca o horário
// como lotado, em vez de deixar o visitante preso na confirmação.
export type CriarAgendamentoResultado = { success: true; agendamentoId: string } | { error: string; slotIndisponivel?: boolean };

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
    mensagem: formData.get("mensagem") || undefined,
    aceite_whatsapp: formData.get("aceite_whatsapp") === "on",
    email: formData.get("email") || undefined,
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
    return { error: "Esse horário não está mais disponível. Escolha outra data ou horário.", slotIndisponivel: true };
  }

  const admin = createAdminClient();
  const ocupadas = await contarVagasOcupadasNoSlot(admin, pagina.id, parsed.data.data_agendada, parsed.data.horario);
  if (ocupadas >= pagina.vagas_por_horario) {
    return { error: "Esse horário acabou de lotar. Escolha outra data ou horário.", slotIndisponivel: true };
  }

  // Defesa em profundidade pro intervalo entre horários (TAREFA agendamentos 2.4) — o client já
  // desabilita esses horários na UI, mas a action é alcançável por POST direto.
  if ((pagina.intervalo_entre_horarios ?? 0) > 0) {
    const ocupadosNoDia = await getHorariosOcupadosPorDia(pagina.id, parsed.data.data_agendada, parsed.data.data_agendada);
    const horariosDoDia = ocupadosNoDia[parsed.data.data_agendada] ?? [];
    if (horarioBloqueadoPorIntervalo(parsed.data.horario, horariosDoDia, pagina.duracao_minutos, pagina.intervalo_entre_horarios ?? 0)) {
      return { error: "Esse horário ficou muito próximo de outro já agendado. Escolha outro horário.", slotIndisponivel: true };
    }
  }

  // E-mail opcional: não é um campo extra configurado pelo admin (pagina.campos_extras), mas
  // precisa cair dentro de campos_extras (jsonb) pra notificarEmailAgendamento achar com o
  // regex de e-mail (src/lib/email/eventos.ts) — sem coluna nova na tabela.
  const camposExtrasComEmail = {
    ...parsed.data.campos_extras,
    ...(parsed.data.email?.trim() ? { email: parsed.data.email.trim() } : {}),
  };

  const dadosBase = {
    pagina_id: pagina.id,
    nome: parsed.data.nome,
    whatsapp: parsed.data.whatsapp,
    data_agendada: parsed.data.data_agendada,
    horario: parsed.data.horario,
    campos_extras: camposExtrasComEmail,
  };

  // "mensagem" (migration 20260919200000) e "email" (migration 20261030500000) são colunas
  // opcionais mais novas que a tabela original — se alguma ainda não existir no banco, o
  // agendamento NÃO pode falhar por causa de um campo que é só um "bônus": tenta de novo sem
  // elas. "email" continua indo pra camposExtrasComEmail (jsonb) mesmo sem a coluna dedicada —
  // notificarEmailAgendamento acha por lá como já fazia antes desta tarefa.
  const dadosCompletos: Record<string, unknown> = { ...dadosBase };
  if (parsed.data.mensagem) dadosCompletos.mensagem = parsed.data.mensagem;
  if (parsed.data.email?.trim()) dadosCompletos.email = parsed.data.email.trim();

  let { data: agendamento, error } = await admin
    .from("agendamentos")
    .insert(dadosCompletos)
    .select("id")
    .single();

  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    console.error("[agendar] coluna opcional ausente em agendamentos — gravando sem mensagem/email dedicados:", error.code);
    ({ data: agendamento, error } = await admin.from("agendamentos").insert(dadosBase).select("id").single());
  }

  if (error || !agendamento) {
    return { error: "Não foi possível confirmar o agendamento. Tente novamente." };
  }

  // Integração com leads (TAREFA CRM 2.2) — best-effort, nunca bloqueia a confirmação do
  // agendamento (que já aconteceu com sucesso acima). Não existe coluna "Visita/Agendado" no
  // seed atual do Kanban (confirmado na PERGUNTA DE FATO 3: só novo/contato/negociacao/
  // matriculado/perdido) — encontrarColunaVisitaAgendado busca por NOME (não id) e devolve null
  // se nenhuma coluna existir com esse nome, caindo nos fallbacks abaixo.
  try {
    const existente = await encontrarLeadPorWhatsappOuEmail(admin, parsed.data.whatsapp, parsed.data.email);
    const colunas = await getKanbanColunas(admin);
    const colunaVisita = encontrarColunaVisitaAgendado(colunas);
    // TAREFA agendamentos — PARTE 3: pagina.campanha_id referencia campanha_paginas (construtor
    // de landing pages), NÃO campanhas_marketing (leads.campanha_id) — são tabelas diferentes,
    // gravar o id ali violaria a FK. Por isso o lead recebe campanha_origem (texto), o mesmo
    // campo que campanha/[slug]/actions.ts já usa pro mesmo tipo de atribuição sem FK.
    const campanhaOrigem = pagina.campanha_id
      ? ((await admin.from("campanha_paginas").select("titulo").eq("id", pagina.campanha_id).maybeSingle()).data
          ?.titulo as string | undefined) ?? null
      : null;

    if (existente) {
      // Só move se achou a coluna de visita — sem ela, mantém a coluna atual do lead (REGRA da
      // tarefa).
      if (colunaVisita && existente.kanban_coluna !== colunaVisita.id) {
        await admin.from("leads").update({ kanban_coluna: colunaVisita.id }).eq("id", existente.id);
      }
      if (campanhaOrigem) {
        await admin.from("leads").update({ campanha_origem: campanhaOrigem }).eq("id", existente.id);
      }
      await admin.from("agendamentos").update({ lead_id: existente.id }).eq("id", agendamento.id);
      await registrarHistoricoLead(
        admin,
        existente.id,
        "agendamento",
        `Agendamento criado: ${parsed.data.data_agendada} às ${parsed.data.horario}`,
      );
    } else {
      const colunaNovo = colunaVisita?.id ?? colunas.find((c) => c.id === "novo")?.id ?? colunas[0]?.id ?? "novo";
      const { data: novoLead } = await admin
        .from("leads")
        .insert({
          nome: parsed.data.nome,
          telefone: parsed.data.whatsapp,
          whatsapp: parsed.data.whatsapp,
          email: parsed.data.email?.trim() || null,
          curso_id: null,
          origem: "agendamento",
          campanha_origem: campanhaOrigem,
          kanban_coluna: colunaNovo,
        })
        .select("id")
        .single();

      if (novoLead) {
        await admin.from("agendamentos").update({ lead_id: novoLead.id }).eq("id", agendamento.id);
        await registrarHistoricoLead(admin, novoLead.id, "criacao", "Lead criado via agendamento público");
      }
    }
  } catch {
    // Best-effort — ver comentário acima.
  }

  // TAREFA agendamentos — PARTE 5: substitui o console.log stub (PERGUNTA DE FATO 1 — era a causa
  // raiz de nenhuma confirmação por WhatsApp ter sido enviada até hoje). Fire-and-forget: não
  // pode atrasar a resposta de sucesso ao visitante.
  notificarWhatsappAgendamentoConfirmacao(agendamento.id);

  dispararFluxosPorGatilho(
    "agendamento_criado",
    {
      telefone: parsed.data.whatsapp,
      nome: parsed.data.nome,
      data: parsed.data.data_agendada,
      horario: parsed.data.horario,
      titulo_pagina: pagina.titulo,
    },
    { tipo: "agendamento", id: agendamento.id },
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
        mensagem: parsed.data.mensagem ?? null,
      },
      `agendamento-criado-${agendamento.id}`,
    );
  } catch {
    // Best-effort — o agendamento já foi confirmado com sucesso acima.
  }

  // E-mail de confirmação (só sai se o visitante informou e-mail, ou se a página tiver um campo
  // extra com e-mail). linkGerenciar: TAREFA agendamentos 2.4 — autoatendimento de
  // cancelamento/remarcação (ver meu-agendamento/[agendamentoId]), incluído no e-mail de
  // confirmação como pedido.
  notificarEmailAgendamento({
    nome: parsed.data.nome,
    camposExtras: camposExtrasComEmail,
    dataISO: parsed.data.data_agendada,
    horario: parsed.data.horario,
    tituloPagina: pagina.titulo,
    linkGerenciar: `${process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app"}/agendar/${pagina.slug}/meu-agendamento/${agendamento.id}`,
  });

  // Webhook de saída (Apps > Webhooks): depois da resposta, nunca bloqueia.
  dispararWebhook("agendamento_criado", {
    agendamento_id: agendamento.id,
    pagina_id: pagina.id,
    titulo_pagina: pagina.titulo,
    nome: parsed.data.nome,
    whatsapp: parsed.data.whatsapp,
    data_agendada: parsed.data.data_agendada,
    horario: parsed.data.horario,
    mensagem: parsed.data.mensagem ?? null,
    campos_extras: parsed.data.campos_extras ?? {},
  });

  return { success: true, agendamentoId: agendamento.id as string };
}
