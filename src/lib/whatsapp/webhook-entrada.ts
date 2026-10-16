import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";
import { dispararFluxosPorGatilho, executarFluxo, retomarExecucaoFluxo } from "@/lib/whatsapp/fluxos";
import { encontrarNo, parseNos, renderizarTextoMenu, type DadosMenu, type NoFluxo } from "@/lib/whatsapp/fluxos-tipos";

// Tipo pra evitar import circular — admin vem de fora pra facilitar teste.
type AdminClient = ReturnType<typeof createAdminClient>;

type SessaoWhatsapp = {
  id: string;
  execucao_id: string | null;
  aguardando_resposta: boolean;
  nome: string | null;
};

// Processa uma mensagem recebida: cria/atualiza a sessão do contato e, se havia uma execução de
// fluxo parada aguardando resposta (aguardando_resposta=true em whatsapp_sessoes, preenchido pelo
// nó "aguardar_resposta" — ver src/lib/whatsapp/fluxos.ts), injeta o texto recebido nas variáveis
// da execução e retoma o fluxo a partir do nó seguinte. Sem execução pendente, verifica se a
// mensagem dispara um gatilho de fluxo (primeira mensagem / palavra-chave).
export async function processarMensagemRecebida(
  admin: AdminClient,
  telefone: string,
  nomeContato: string | null,
  texto: string,
  logId: string | undefined,
): Promise<void> {
  let sessao: SessaoWhatsapp | null = null;

  const { data: sessaoExistente } = await admin
    .from("whatsapp_sessoes")
    .select("id, execucao_id, aguardando_resposta, nome")
    .eq("telefone", telefone)
    .maybeSingle();

  if (sessaoExistente) {
    sessao = sessaoExistente as SessaoWhatsapp;
    await admin
      .from("whatsapp_sessoes")
      .update({ nome: nomeContato ?? sessao.nome, ultima_mensagem_em: new Date().toISOString() })
      .eq("id", sessao.id);
  } else {
    const { data: criada } = await admin
      .from("whatsapp_sessoes")
      .insert({ telefone, nome: nomeContato })
      .select("id, execucao_id, aguardando_resposta, nome")
      .single();
    sessao = criada as SessaoWhatsapp | null;
  }

  if (!sessao) {
    console.error("[whatsapp:webhook] falha ao criar/buscar sessão para", telefone);
    return;
  }

  if (sessao.execucao_id && sessao.aguardando_resposta) {
    const { data: execucao } = await admin
      .from("whatsapp_fluxos_execucoes")
      .select("variaveis, no_atual, fluxo_id")
      .eq("id", sessao.execucao_id)
      .maybeSingle();

    let limparSessao = true;

    if (execucao) {
      const variaveisAtuais = (execucao.variaveis as Record<string, string>) ?? {};
      const noAtual = await buscarNo(admin, execucao.fluxo_id, execucao.no_atual);

      if (noAtual?.tipo === "menu") {
        limparSessao = await processarRespostaMenu(admin, sessao.execucao_id, telefone, noAtual, variaveisAtuais, texto);
      } else {
        const novasVariaveis = { ...variaveisAtuais, resposta: texto };
        await admin
          .from("whatsapp_fluxos_execucoes")
          .update({
            resposta_recebida: texto,
            aguardando_resposta: false,
            variaveis: novasVariaveis,
            retomar_em: null,
          })
          .eq("id", sessao.execucao_id);

        await retomarExecucaoFluxo(sessao.execucao_id);
      }
    }

    if (limparSessao) {
      await admin.from("whatsapp_sessoes").update({ execucao_id: null, aguardando_resposta: false }).eq("id", sessao.id);
    }
  } else {
    await verificarGatilhos(admin, telefone, nomeContato, texto);
  }

  if (logId) {
    await admin
      .from("whatsapp_mensagens_recebidas")
      .update({ processado: true, processado_em: new Date().toISOString() })
      .eq("id", logId);
  }
}

async function buscarNo(admin: AdminClient, fluxoId: string, noId: string | null): Promise<NoFluxo | null> {
  if (!noId) return null;
  const { data: fluxo } = await admin.from("whatsapp_fluxos").select("nos").eq("id", fluxoId).maybeSingle();
  if (!fluxo) return null;
  return encontrarNo(parseNos(fluxo.nos), noId) ?? null;
}

// Roteia a resposta de um nó "menu" (ver src/lib/whatsapp/fluxos.ts): número reconhecido avança
// pro proximo_id da opção; número não reconhecido reenvia o menu (fica pausado, sessão mantida)
// ou segue pela primeira opção/conclui, conforme dados.reenviar_invalido. Retorna se a sessão
// deve ser limpa depois (false só no caso de reenvio — o fluxo continua esperando resposta).
async function processarRespostaMenu(
  admin: AdminClient,
  execucaoId: string,
  telefone: string,
  noMenu: NoFluxo,
  variaveisAtuais: Record<string, string>,
  texto: string,
): Promise<boolean> {
  const dadosMenu = noMenu.dados as DadosMenu;
  const opcoes = dadosMenu.opcoes ?? [];
  const numero = Number.parseInt(texto.trim(), 10);
  const opcaoEscolhida = opcoes.find((o) => o.numero === numero);

  if (opcaoEscolhida) {
    await admin
      .from("whatsapp_fluxos_execucoes")
      .update({
        resposta_recebida: texto,
        no_atual: opcaoEscolhida.proximo_id,
        aguardando_resposta: false,
        variaveis: { ...variaveisAtuais, resposta: texto, menu_escolha: opcaoEscolhida.label },
        retomar_em: null,
      })
      .eq("id", execucaoId);

    await retomarExecucaoFluxo(execucaoId);
    return true;
  }

  if (dadosMenu.reenviar_invalido) {
    const textoMenu = renderizarTextoMenu(dadosMenu, variaveisAtuais);
    if (textoMenu) await enviarWhatsApp(telefone, textoMenu);
    return false; // mantém pausado — não limpa a sessão, não avança no_atual.
  }

  // reenviar_invalido=false: segue pela primeira opção configurada ou conclui o fluxo, se nem
  // isso existir (opcoes vazio ou proximo_id da 1ª opção em branco).
  const destinoPadrao = opcoes[0]?.proximo_id || null;
  if (destinoPadrao) {
    await admin
      .from("whatsapp_fluxos_execucoes")
      .update({
        resposta_recebida: texto,
        no_atual: destinoPadrao,
        aguardando_resposta: false,
        variaveis: { ...variaveisAtuais, resposta: texto },
        retomar_em: null,
      })
      .eq("id", execucaoId);

    await retomarExecucaoFluxo(execucaoId);
  } else {
    await admin
      .from("whatsapp_fluxos_execucoes")
      .update({
        resposta_recebida: texto,
        status: "concluido",
        aguardando_resposta: false,
        variaveis: { ...variaveisAtuais, resposta: texto },
        retomar_em: null,
      })
      .eq("id", execucaoId);
  }
  return true;
}

// Sem execução de fluxo pendente: verifica se a mensagem dispara algum fluxo com gatilho
// "primeira_mensagem" (primeiro contato já registrado — a mensagem atual já foi inserida pelo
// webhook antes de chamar processarMensagemRecebida, então count<=1 é a primeira de verdade) ou
// "palavra_chave" (busca a palavra configurada no nó de gatilho de cada fluxo ativo desse tipo).
async function verificarGatilhos(
  admin: AdminClient,
  telefone: string,
  nomeContato: string | null,
  texto: string,
): Promise<void> {
  const { count: totalMsgs } = await admin
    .from("whatsapp_mensagens_recebidas")
    .select("id", { count: "exact", head: true })
    .eq("telefone", telefone);

  if ((totalMsgs ?? 0) <= 1) {
    try {
      await dispararFluxosPorGatilho("primeira_mensagem", { telefone, nome: nomeContato ?? "", mensagem: texto });
    } catch (err) {
      console.error("[whatsapp:webhook] erro ao disparar primeira_mensagem:", err);
    }
  }

  const { data: fluxosPalavra } = await admin
    .from("whatsapp_fluxos")
    .select("id, nos")
    .eq("gatilho", "palavra_chave")
    .eq("ativo", true);

  if (!fluxosPalavra?.length) return;

  const textoNorm = texto.toLowerCase().trim();

  for (const fluxo of fluxosPalavra as { id: string; nos: unknown }[]) {
    try {
      const nos = parseNos(fluxo.nos);
      const gatilhoNo = nos.find((n: NoFluxo) => n.tipo === "gatilho");
      const palavrasStr = gatilhoNo?.dados.palavras ?? "";
      if (!palavrasStr) continue;

      const palavras = palavrasStr
        .split(",")
        .map((p: string) => p.trim().toLowerCase())
        .filter(Boolean);

      const palavraEncontrada = palavras.find((p: string) => textoNorm.includes(p));
      if (!palavraEncontrada) continue;

      await executarFluxo(fluxo.id, telefone, { telefone, nome: nomeContato ?? "", mensagem: texto, palavra: palavraEncontrada });
    } catch (err) {
      console.error("[whatsapp:webhook] erro ao disparar palavra_chave:", fluxo.id, err);
    }
  }
}
