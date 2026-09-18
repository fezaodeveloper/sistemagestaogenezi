"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { criarOuAtualizarLeadPublico } from "@/lib/leads/leads";
import { getCampanhaPaginaPublica, contarRespostasAdmin } from "@/lib/campanha-paginas/campanha-paginas";
import {
  campanhaRespostaPublicaSchema,
  RESPOSTA_CHAVE_DECLARACAO,
  RESPOSTA_CHAVE_LGPD,
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
    cidade: formData.get("cidade") || undefined,
    respostas: respostasRaw ? JSON.parse(String(respostasRaw)) : {},
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const pagina = await getCampanhaPaginaPublica(supabase, slug);
  if (!pagina) {
    return { error: "Página de campanha não encontrada." };
  }

  if (pagina.mostrar_lgpd && !aceiteLgpd) {
    return { error: "É preciso concordar com o tratamento dos seus dados (LGPD)." };
  }
  if (pagina.mostrar_declaracao && !aceiteDeclaracao) {
    return { error: "É preciso confirmar a declaração de interesse." };
  }

  const agora = new Date();
  if (pagina.data_inicio && agora < new Date(pagina.data_inicio)) {
    return { error: "As inscrições ainda não começaram." };
  }
  if (pagina.data_fim && agora > new Date(pagina.data_fim)) {
    return { error: "As inscrições para esta campanha já encerraram." };
  }

  const admin = createAdminClient();

  if (pagina.vagas_limite) {
    const totalAtual = await contarRespostasAdmin(admin, pagina.id);
    if (totalAtual >= pagina.vagas_limite) {
      return { error: "As vagas para esta campanha se esgotaram." };
    }
  }

  const respostasCompletas: Record<string, string | boolean> = {
    ...parsed.data.respostas,
    [RESPOSTA_CHAVE_LGPD]: aceiteLgpd,
    [RESPOSTA_CHAVE_DECLARACAO]: aceiteDeclaracao,
  };

  const { error } = await admin.from("campanha_respostas").insert({
    pagina_id: pagina.id,
    nome: parsed.data.nome,
    whatsapp: parsed.data.whatsapp,
    idade: parsed.data.idade,
    email: parsed.data.email ?? null,
    cidade: parsed.data.cidade ?? null,
    respostas: respostasCompletas,
  });

  if (error) {
    return { error: "Não foi possível enviar sua inscrição. Tente novamente." };
  }

  // Cria lead automaticamente só quando a página tem curso vinculado — ver
  // comentário na migration sobre campanha_paginas.curso_id (leads.curso_id
  // é NOT NULL, então sem curso configurado não há como satisfazer a
  // constraint). A resposta já foi salva com sucesso de qualquer forma.
  if (pagina.curso_id) {
    try {
      await criarOuAtualizarLeadPublico({
        nome: parsed.data.nome,
        telefone: parsed.data.whatsapp,
        curso_id: pagina.curso_id,
        origem: "campanha",
        observacoes: `Via página de campanha: ${pagina.titulo}`,
      });
    } catch {
      // Best-effort — a resposta em campanha_respostas já é o registro
      // principal, o lead é um bônus pro CRM.
    }
  }

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
