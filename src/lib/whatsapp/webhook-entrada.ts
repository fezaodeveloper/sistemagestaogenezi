import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { retomarExecucaoFluxo } from "@/lib/whatsapp/fluxos";

// Tipo pra evitar import circular — admin vem de fora pra facilitar teste.
type AdminClient = ReturnType<typeof createAdminClient>;

type SessaoWhatsapp = {
  id: string;
  execucao_id: string | null;
  aguardando_resposta: boolean;
  nome: string | null;
};

// Processa uma mensagem recebida: cria/atualiza a sessão do contato e, se havia uma execução de
// fluxo parada aguardando resposta (aguardando_resposta=true em whatsapp_sessoes), injeta o texto
// recebido nas variáveis da execução e retoma o fluxo a partir do nó seguinte.
//
// LIMITAÇÃO CONHECIDA (de propósito, por decisão de escopo): nenhum nó do editor de fluxos hoje
// pausa esperando resposta do contato (TIPOS_NO só tem gatilho/mensagem/aguardar-por-tempo/
// condicao/fim — ver src/lib/whatsapp/fluxos-tipos.ts), então `execucao_id`/`aguardando_resposta`
// em whatsapp_sessoes nunca são preenchidos por nada hoje — este caminho é infraestrutura pronta
// pra quando esse tipo de nó existir. Até lá, toda mensagem recebida sem execução pendente só
// fica registrada no log (whatsapp_mensagens_recebidas), sem disparar fluxo nenhum.
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
  }

  if (logId) {
    await admin
      .from("whatsapp_mensagens_recebidas")
      .update({ processado: true, processado_em: new Date().toISOString() })
      .eq("id", logId);
  }
}
