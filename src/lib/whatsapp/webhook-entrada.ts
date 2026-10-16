import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispararFluxosPorGatilho, executarFluxo, retomarExecucaoFluxo } from "@/lib/whatsapp/fluxos";
import { parseNos, type NoFluxo } from "@/lib/whatsapp/fluxos-tipos";

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
      .select("variaveis")
      .eq("id", sessao.execucao_id)
      .maybeSingle();

    if (execucao) {
      const novasVariaveis = { ...((execucao.variaveis as Record<string, string>) ?? {}), resposta: texto };
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

    await admin.from("whatsapp_sessoes").update({ execucao_id: null, aguardando_resposta: false }).eq("id", sessao.id);
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
