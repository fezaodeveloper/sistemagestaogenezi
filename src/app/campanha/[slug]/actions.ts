"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import {
  encontrarLeadPorWhatsappOuEmail,
  getKanbanColunas,
  registrarHistoricoLead,
} from "@/lib/leads/leads";
import { MUNICIPIOS_POR_UF } from "@/lib/ibge/municipios";
import { normalizarBusca } from "@/lib/busca";
import { notificarEmailLeadCampanha } from "@/lib/email/eventos";
import { getCampanhaPaginaPublica, contarRespostasAdmin } from "@/lib/campanha-paginas/campanha-paginas";
import {
  campanhaRespostaPublicaSchema,
  RESPOSTA_CHAVE_DECLARACAO,
  RESPOSTA_CHAVE_LGPD,
  type RespostaValor,
} from "@/lib/campanha-paginas/schema";

export type EnviarRespostaResultado = { success: true } | { error: string };

// Sem requireRole de propósito — é a única Server Action deste módulo
// genuinamente alcançável por um visitante sem conta (mesmo espírito de
// criarOuAtualizarLeadPublico e criarAgendamentoPublico). Roda com o client
// admin (service_role) pra poder reconferir vagas_limite/período no exato
// momento do envio, sem depender de select público em `campanha_respostas`
// (que não existe — só insert, ver migration).
export async function enviarRespostaCampanha(slug: string, formData: FormData): Promise<EnviarRespostaResultado> {
  const respostasRaw = formData.get("respostas");
  const aceiteLgpd = formData.get("aceite_lgpd") === "on";
  const aceiteDeclaracao = formData.get("aceite_declaracao") === "on";

  const parsed = campanhaRespostaPublicaSchema.safeParse({
    nome: formData.get("nome"),
    whatsapp: formData.get("whatsapp"),
    idade: formData.get("idade"),
    email: formData.get("email") || undefined,
    estado: formData.get("estado") || undefined,
    cidade: formData.get("cidade") || undefined,
    respostas: respostasRaw ? JSON.parse(String(respostasRaw)) : {},
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // client admin (service_role) já aqui em vez do client autenticado normal
  // — mesmo motivo do page.tsx (evitar "JWT failed verification" com cookie
  // de sessão inválido no navegador do visitante).
  const admin = createAdminClient();
  const pagina = await getCampanhaPaginaPublica(admin, slug);
  if (!pagina) {
    return { error: "Página de campanha não encontrada." };
  }

  // getCampanhaPaginaPublica também devolve páginas "encerrada" (pra exibir o
  // banner) — o envio precisa recusar explicitamente.
  if (pagina.status === "encerrada") {
    return { error: "As inscrições para esta campanha já encerraram." };
  }

  // Com etapa de confirmação, os dois aceites são obrigatórios (ignora os
  // toggles da aba Termos, que valem só pra tela final padrão).
  const exigeAmbosAceites = pagina.etapas.some((etapa) => etapa.tipo === "confirmacao");
  if ((exigeAmbosAceites || pagina.mostrar_lgpd) && !aceiteLgpd) {
    return { error: "É preciso concordar com o tratamento dos seus dados (LGPD)." };
  }
  if ((exigeAmbosAceites || pagina.mostrar_declaracao) && !aceiteDeclaracao) {
    return { error: "É preciso confirmar a declaração de interesse." };
  }

  if (pagina.coletar_cidade && (!parsed.data.estado || !parsed.data.cidade)) {
    return { error: "Informe seu estado e seu município." };
  }
  // O município vem de um select filtrado pelo estado: confere contra a mesma
  // lista estática (o formulário é alcançável por POST direto).
  if (parsed.data.estado && parsed.data.cidade) {
    const municipios = MUNICIPIOS_POR_UF[parsed.data.estado] ?? [];
    const cidadeNormalizada = normalizarBusca(parsed.data.cidade);
    if (!municipios.some((municipio) => normalizarBusca(municipio) === cidadeNormalizada)) {
      return { error: "Selecione um município válido para o estado escolhido." };
    }
  }

  const agora = new Date();
  if (pagina.data_inicio && agora < new Date(pagina.data_inicio)) {
    return { error: "As inscrições ainda não começaram." };
  }
  if (pagina.data_fim && agora > new Date(pagina.data_fim)) {
    return { error: "As inscrições para esta campanha já encerraram." };
  }

  if (pagina.vagas_limite) {
    const totalAtual = await contarRespostasAdmin(admin, pagina.id);
    if (totalAtual >= pagina.vagas_limite) {
      return { error: "As vagas para esta campanha se esgotaram." };
    }
  }

  const respostasCompletas: Record<string, RespostaValor> = {
    ...parsed.data.respostas,
    [RESPOSTA_CHAVE_LGPD]: aceiteLgpd,
    [RESPOSTA_CHAVE_DECLARACAO]: aceiteDeclaracao,
  };

  // UTM (TAREFA CRM 2.2, PARTE 3) — vêm como hidden fields do form (lidos de searchParams em
  // page.tsx), não como parâmetro próprio da Server Action: formData é a única via de dados do
  // client pra aqui, igual a todo o resto do formulário.
  const utmSource = (formData.get("utm_source") as string | null)?.trim() || null;
  const utmMedium = (formData.get("utm_medium") as string | null)?.trim() || null;
  const utmCampaign = (formData.get("utm_campaign") as string | null)?.trim() || null;

  // Resolve/cria o lead ANTES de inserir a resposta, pra já gravar lead_id junto (evita um UPDATE
  // separado em campanha_respostas). Best-effort: a resposta é o registro principal (REGRA já
  // documentada abaixo), o lead nunca pode bloquear o envio.
  //
  // TAREFA CRM 2.2 — agora cria lead SEMPRE, mesmo sem curso vinculado (leads.curso_id ficou
  // nullable, migration 20261030300000). campanha_id fica sempre null: campanha_paginas não tem
  // FK pra campanhas_marketing (confirmado na PERGUNTA DE FATO 4) — são tabelas sem vínculo
  // nenhum hoje, "a campanha da página" não existe como dado, só o título (campanha_origem).
  let leadId: string | null = null;
  try {
    const existente = await encontrarLeadPorWhatsappOuEmail(admin, parsed.data.whatsapp, parsed.data.email);
    if (existente) {
      await admin
        .from("leads")
        .update({
          campanha_origem: pagina.titulo,
          utm_source: utmSource ?? existente.utm_source,
          utm_medium: utmMedium ?? existente.utm_medium,
          utm_campaign: utmCampaign ?? existente.utm_campaign,
        })
        .eq("id", existente.id);
      await registrarHistoricoLead(
        admin,
        existente.id,
        "anotacao",
        `Preencheu formulário da campanha: ${pagina.titulo}`,
      );
      leadId = existente.id;
    } else {
      const colunas = await getKanbanColunas(admin);
      const colunaNovo = colunas.find((c) => c.id === "novo")?.id ?? colunas[0]?.id ?? "novo";
      const { data: novoLead } = await admin
        .from("leads")
        .insert({
          nome: parsed.data.nome,
          telefone: parsed.data.whatsapp,
          whatsapp: parsed.data.whatsapp,
          email: parsed.data.email ?? null,
          curso_id: pagina.curso_id ?? null,
          origem: "campanha",
          campanha_origem: pagina.titulo,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          kanban_coluna: colunaNovo,
        })
        .select("id")
        .single();

      if (novoLead) {
        leadId = novoLead.id;
        await registrarHistoricoLead(
          admin,
          novoLead.id,
          "criacao",
          `Lead captado via página de campanha: ${pagina.titulo}`,
        );
      }
    }
  } catch {
    // Best-effort — ver comentário acima.
  }

  const { error } = await admin.from("campanha_respostas").insert({
    pagina_id: pagina.id,
    nome: parsed.data.nome,
    whatsapp: parsed.data.whatsapp,
    idade: parsed.data.idade,
    email: parsed.data.email ?? null,
    estado: parsed.data.estado ?? null,
    cidade: parsed.data.cidade ?? null,
    respostas: respostasCompletas,
    lead_id: leadId,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  });

  if (error) {
    return { error: "Não foi possível enviar sua inscrição. Tente novamente." };
  }

  // E-mail de confirmação da inscrição (só sai se o visitante informou e-mail).
  notificarEmailLeadCampanha({ nome: parsed.data.nome, email: parsed.data.email, nomeCampanha: pagina.titulo });

  // Stub — Evolution API virá depois.
  console.log(
    `[campanha] Enviaria confirmação por WhatsApp para ${parsed.data.nome} (${parsed.data.whatsapp}): inscrição recebida em "${pagina.titulo}"`,
  );

  if (pagina.notificar_telegram) {
    try {
      await dispararEvento(
        "campanha.resposta.criada",
        {
          titulo_pagina: pagina.titulo,
          nome: parsed.data.nome,
          whatsapp: parsed.data.whatsapp,
          cidade: parsed.data.cidade ?? "—",
        },
        `campanha-resposta-${pagina.id}-${parsed.data.whatsapp}-${Date.now()}`,
      );
    } catch {
      // Best-effort — a resposta já foi salva com sucesso acima.
    }
  }

  return { success: true };
}
