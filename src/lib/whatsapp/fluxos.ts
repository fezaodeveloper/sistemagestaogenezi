import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import {
  avaliarCondicao,
  encontrarGatilho,
  encontrarNo,
  parseNos,
  renderizarTextoFluxo,
  renderizarTextoMenu,
  type FluxoGatilho,
  type NoFluxo,
} from "@/lib/whatsapp/fluxos-tipos";

// Executor dos fluxos personalizados do GênZap. Roda os nós EM SÉRIE (nunca em paralelo: um
// "mensagem" já embute o delay anti-banimento de enviarWhatsApp) até bater num nó "aguardar"
// (pausa por tempo — quem retoma é o cron, ver retomarExecucoesPendentes), num "aguardar_resposta"
// ou "menu" (pausa esperando o contato responder — quem retoma é o webhook de entrada, ver
// src/app/api/webhooks/evolution/route.ts e src/lib/whatsapp/webhook-entrada.ts), num "fim"
// (conclui) ou num erro (marca "erro", nunca lança pro chamador).
//
// LIMITAÇÃO CONHECIDA — granularidade do "aguardar" (por tempo, não "aguardar_resposta"): o cron
// que retoma execuções paradas roda 1x/dia (ver src/app/api/cron/whatsapp-fluxos/route.ts —
// mesма restrição já aceita pelo projeto pra sms-recuperacao, plano Hobby da Vercel só permite
// crons diários). Um nó "aguardar 1 hora" na prática só retoma na próxima execução do cron, não
// exatamente 1h depois. Documentado também no editor.

const MAX_PASSOS = 100; // trava contra fluxo com laço infinito sem "aguardar"/"fim"

type Admin = ReturnType<typeof createAdminClient>;
type ExecucaoBase = { id: string; telefone: string; variaveis: Record<string, string> };

// Processa nós a partir de `noInicialId` (inclusive), atualizando a linha de execução conforme
// avança. Sempre retorna (nunca lança) — todo caminho de saída grava um status final ou pausa.
async function processarAPartirDe(admin: Admin, execucao: ExecucaoBase, nos: NoFluxo[], noInicialId: string | null): Promise<void> {
  let atualId = noInicialId;
  let passos = 0;

  while (atualId) {
    if (++passos > MAX_PASSOS) {
      await admin
        .from("whatsapp_fluxos_execucoes")
        .update({ status: "erro", erro_detalhe: "Limite de passos excedido (possível laço no fluxo)." })
        .eq("id", execucao.id);
      return;
    }

    const no = encontrarNo(nos, atualId);
    if (!no) {
      await admin
        .from("whatsapp_fluxos_execucoes")
        .update({ status: "erro", erro_detalhe: `Nó "${atualId}" não encontrado no fluxo.` })
        .eq("id", execucao.id);
      return;
    }

    if (no.tipo === "fim") {
      await admin.from("whatsapp_fluxos_execucoes").update({ status: "concluido", no_atual: no.id, retomar_em: null }).eq("id", execucao.id);
      return;
    }

    if (no.tipo === "aguardar") {
      const segundos = Math.max(1, Math.floor(Number(no.dados.segundos) || 0));
      const retomarEm = new Date(Date.now() + segundos * 1000).toISOString();
      await admin
        .from("whatsapp_fluxos_execucoes")
        .update({ no_atual: no.proximos[0] ?? null, retomar_em: retomarEm })
        .eq("id", execucao.id);
      return; // pausa: o cron retoma quando retomar_em vencer.
    }

    if (no.tipo === "mensagem") {
      const texto = renderizarTextoFluxo(no.dados.texto ?? "", execucao.variaveis).trim();
      if (texto && execucao.telefone) {
        await enviarWhatsApp(execucao.telefone, texto);
      }
      atualId = no.proximos[0] ?? null;
      continue;
    }

    if (no.tipo === "aguardar_resposta") {
      const timeoutHoras = Number(no.dados.timeout_horas) || 0;
      const atualizacao: Record<string, unknown> = {
        no_atual: no.proximos[0] ?? null,
        aguardando_resposta: true,
        retomar_em: null,
      };
      if (timeoutHoras > 0) {
        // __timeout_no: bookkeeping interno (não é placeholder de mensagem) — guardado aqui
        // porque, a essa altura, no_atual JÁ foi avançado pro destino de SUCESSO (proximos[0]),
        // não pro próprio nó "aguardar_resposta" de onde viria dados.no_timeout. Removido de
        // volta em retomarExecucaoPorTimeout, antes de seguir o fluxo.
        atualizacao.retomar_em = new Date(Date.now() + timeoutHoras * 3_600_000).toISOString();
        atualizacao.variaveis = { ...execucao.variaveis, __timeout_no: no.dados.no_timeout ?? "" };
      }

      await admin.from("whatsapp_fluxos_execucoes").update(atualizacao).eq("id", execucao.id);

      // Vincula a sessão do contato a esta execução — o webhook de entrada
      // (src/app/api/webhooks/evolution/route.ts) usa isso pra saber qual execução retomar
      // quando a resposta chegar.
      await admin.from("whatsapp_sessoes").upsert(
        {
          telefone: execucao.telefone,
          execucao_id: execucao.id,
          aguardando_resposta: true,
          ultima_mensagem_em: new Date().toISOString(),
        },
        { onConflict: "telefone" },
      );

      return; // pausa — webhook-entrada.ts retoma na resposta, ou o cron retoma no timeout.
    }

    if (no.tipo === "menu") {
      const textoFinal = renderizarTextoMenu(no.dados, execucao.variaveis);
      if (textoFinal && execucao.telefone) {
        await enviarWhatsApp(execucao.telefone, textoFinal);
      }

      // no_atual aponta pro PRÓPRIO nó "menu" (diferente de "aguardar_resposta", que avança pra
      // proximos[0]) — o webhook de entrada precisa achar dados.opcoes ao processar a resposta, e
      // só consegue se no_atual ainda for o id deste nó. Setado explicitamente (não "fica de
      // carona" do valor anterior): um nó intermediário passado no mesmo loop (ex.: uma
      // "mensagem" antes deste "menu") nunca persiste no_atual até um ponto de pausa de verdade.
      await admin
        .from("whatsapp_fluxos_execucoes")
        .update({ no_atual: no.id, aguardando_resposta: true, retomar_em: null })
        .eq("id", execucao.id);

      await admin.from("whatsapp_sessoes").upsert(
        {
          telefone: execucao.telefone,
          execucao_id: execucao.id,
          aguardando_resposta: true,
          ultima_mensagem_em: new Date().toISOString(),
        },
        { onConflict: "telefone" },
      );

      return; // pausa — webhook-entrada.ts roteia a resposta pra opção escolhida.
    }

    if (no.tipo === "condicao" && no.dados.campo && no.dados.operador) {
      const verdadeiro = avaliarCondicao({ campo: no.dados.campo, operador: no.dados.operador, valor: no.dados.valor ?? "" }, execucao.variaveis);
      atualId = (verdadeiro ? no.proximos[0] : no.proximos[1]) ?? null;
      continue;
    }

    // "gatilho" (só no primeiro passo) ou "condicao" mal configurada: segue pro próximo direto.
    atualId = no.proximos[0] ?? null;
  }

  // Sem próximo nó (fluxo sem "fim" explícito no final do caminho) — trata como concluído.
  await admin.from("whatsapp_fluxos_execucoes").update({ status: "concluido", retomar_em: null }).eq("id", execucao.id);
}

export type EntidadeFluxo = { tipo: "lead" | "aluno" | "agendamento"; id: string };

// Cria a linha de execução e roda o fluxo a partir do nó de gatilho. Nunca lança.
export async function executarFluxo(
  fluxoId: string,
  telefone: string,
  variaveis: Record<string, string>,
  entidade?: EntidadeFluxo,
): Promise<{ execucaoId: string } | null> {
  try {
    const admin = createAdminClient();
    const { data: fluxo } = await admin.from("whatsapp_fluxos").select("id, nos").eq("id", fluxoId).maybeSingle();
    if (!fluxo) return null;

    const nos = parseNos(fluxo.nos);
    const gatilho = encontrarGatilho(nos);
    if (!gatilho) return null;

    const { data: execucao, error } = await admin
      .from("whatsapp_fluxos_execucoes")
      .insert({
        fluxo_id: fluxoId,
        entidade_tipo: entidade?.tipo ?? null,
        entidade_id: entidade?.id ?? null,
        telefone,
        variaveis,
        no_atual: gatilho.id,
      })
      .select("id")
      .single();
    if (error || !execucao) return null;

    await processarAPartirDe(admin, { id: execucao.id, telefone, variaveis }, nos, gatilho.id);
    return { execucaoId: execucao.id as string };
  } catch (erro) {
    console.error("[whatsapp:fluxos] falha ao executar fluxo", erro);
    return null;
  }
}

// Retoma uma execução parada num nó "aguardar" cujo prazo já venceu. Nunca lança.
export async function retomarExecucaoFluxo(execucaoId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: execucao } = await admin
      .from("whatsapp_fluxos_execucoes")
      .select("id, fluxo_id, telefone, variaveis, no_atual, status")
      .eq("id", execucaoId)
      .maybeSingle();
    if (!execucao || execucao.status !== "em_andamento" || !execucao.no_atual) return;

    const { data: fluxo } = await admin.from("whatsapp_fluxos").select("nos").eq("id", execucao.fluxo_id).maybeSingle();
    if (!fluxo) {
      await admin
        .from("whatsapp_fluxos_execucoes")
        .update({ status: "erro", erro_detalhe: "Fluxo não encontrado (pode ter sido excluído)." })
        .eq("id", execucaoId);
      return;
    }

    const nos = parseNos(fluxo.nos);
    await processarAPartirDe(
      admin,
      { id: execucao.id, telefone: execucao.telefone, variaveis: (execucao.variaveis as Record<string, string>) ?? {} },
      nos,
      execucao.no_atual,
    );
  } catch (erro) {
    console.error("[whatsapp:fluxos] falha ao retomar execução", erro);
  }
}

// Retoma uma execução parada num "aguardar_resposta" cujo timeout (dados.timeout_horas) venceu
// sem resposta do contato. Diferente de retomarExecucaoFluxo (que resume pelo caminho de
// RESPOSTA recebida, a partir de execucao.no_atual): aqui o destino é __timeout_no, guardado em
// `variaveis` no momento da pausa — ver comentário em processarAPartirDe. Nunca lança.
export async function retomarExecucaoPorTimeout(execucaoId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: execucao } = await admin
      .from("whatsapp_fluxos_execucoes")
      .select("id, fluxo_id, telefone, variaveis, status")
      .eq("id", execucaoId)
      .maybeSingle();
    if (!execucao || execucao.status !== "em_andamento") return;

    const variaveis = { ...((execucao.variaveis as Record<string, string>) ?? {}) };
    const noTimeoutId = variaveis.__timeout_no || null;
    delete variaveis.__timeout_no;

    await admin
      .from("whatsapp_fluxos_execucoes")
      .update({ aguardando_resposta: false, retomar_em: null, variaveis })
      .eq("id", execucaoId);
    await admin
      .from("whatsapp_sessoes")
      .update({ execucao_id: null, aguardando_resposta: false })
      .eq("execucao_id", execucaoId);

    const { data: fluxo } = await admin.from("whatsapp_fluxos").select("nos").eq("id", execucao.fluxo_id).maybeSingle();
    if (!fluxo) {
      await admin
        .from("whatsapp_fluxos_execucoes")
        .update({ status: "erro", erro_detalhe: "Fluxo não encontrado (pode ter sido excluído)." })
        .eq("id", execucaoId);
      return;
    }

    const nos = parseNos(fluxo.nos);
    // noTimeoutId null: processarAPartirDe com noInicialId null não entra no while e cai direto
    // no "sem próximo nó" (marca concluído) — mesmo efeito do nó "fim".
    await processarAPartirDe(admin, { id: execucao.id, telefone: execucao.telefone, variaveis }, nos, noTimeoutId);
  } catch (erro) {
    console.error("[whatsapp:fluxos] falha ao processar timeout de aguardar_resposta", erro);
  }
}

// Chamado nos pontos de disparo do sistema (src/lib/whatsapp/eventos.ts e os pontos de
// criação/confirmação equivalentes fora dele — ver relatório) além do envio automático já
// existente. `variaveis.telefone` é obrigatório (sem telefone não há como enviar); os fluxos
// ativos com esse gatilho rodam em série (nunca em paralelo, pra não atropelar o
// anti-banimento). Nunca lança.
export async function dispararFluxosPorGatilho(
  gatilho: FluxoGatilho,
  variaveis: Record<string, string>,
  entidade?: EntidadeFluxo,
): Promise<void> {
  try {
    const telefone = variaveis.telefone;
    if (!telefone) return;

    const admin = createAdminClient();
    const { data } = await admin.from("whatsapp_fluxos").select("id").eq("gatilho", gatilho).eq("ativo", true);
    for (const fluxo of (data ?? []) as { id: string }[]) {
      await executarFluxo(fluxo.id, telefone, variaveis, entidade);
    }
  } catch (erro) {
    console.error("[whatsapp:fluxos] falha ao disparar fluxos por gatilho", erro);
  }
}

// Chamado pelo cron: retoma toda execução "em_andamento" cujo retomar_em já passou — duas
// categorias, mutuamente exclusivas por aguardando_resposta, que exigem destinos diferentes:
// aguardando_resposta=false é o nó "aguardar" (por tempo, retoma em no_atual/proximos[0]);
// aguardando_resposta=true é o "aguardar_resposta" com timeout vencido (retoma em no_timeout).
export async function retomarExecucoesPendentes(limite = 200): Promise<{ retomadas: number }> {
  const admin = createAdminClient();
  const agora = new Date().toISOString();

  const { data: porTempo } = await admin
    .from("whatsapp_fluxos_execucoes")
    .select("id")
    .eq("status", "em_andamento")
    .eq("aguardando_resposta", false)
    .not("retomar_em", "is", null)
    .lte("retomar_em", agora)
    .limit(limite);

  const { data: porTimeout } = await admin
    .from("whatsapp_fluxos_execucoes")
    .select("id")
    .eq("status", "em_andamento")
    .eq("aguardando_resposta", true)
    .not("retomar_em", "is", null)
    .lte("retomar_em", agora)
    .limit(limite);

  const pendentesPorTempo = (porTempo ?? []) as { id: string }[];
  for (const execucao of pendentesPorTempo) {
    await retomarExecucaoFluxo(execucao.id);
  }

  const pendentesPorTimeout = (porTimeout ?? []) as { id: string }[];
  for (const execucao of pendentesPorTimeout) {
    await retomarExecucaoPorTimeout(execucao.id);
  }

  return { retomadas: pendentesPorTempo.length + pendentesPorTimeout.length };
}
