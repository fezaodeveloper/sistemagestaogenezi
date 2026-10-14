import "server-only";

import { carregarConfigWhatsapp } from "@/lib/whatsapp/config";
import { enviarMensagemTexto } from "@/lib/whatsapp/evolution";
import { normalizarTelefone } from "@/lib/mensagens/texto";

export type ResultadoWhatsapp = { ok: boolean; enviado: boolean; erro?: string };

// Função principal do GênZap: busca a configuração, aplica o delay anti-banimento e envia.
// Nunca lança. Se o WhatsApp não estiver ativo/conectado, devolve {ok:true, enviado:false} —
// mesmo "stub silencioso" que o resto do projeto usa pra integração desligada (ver
// src/lib/integrax/sms.ts) — quem chama nunca precisa checar "está configurado?" antes.
//
// É uma chamada de REDE com delay de alguns segundos (anti-banimento) — quem dispara a partir de
// uma ação do usuário (clique de botão) deve envolver a chamada em `after()` pra não travar a
// resposta; os crons (que já processam item a item em loop) chamam direto, o delay entre
// mensagens sendo justamente o comportamento anti-banimento desejado.
export async function enviarWhatsApp(telefone: string, mensagem: string): Promise<ResultadoWhatsapp> {
  const numeroNormalizado = normalizarTelefone(telefone);
  if (!numeroNormalizado) {
    console.warn("[whatsapp] telefone inválido, envio ignorado:", telefone);
    return { ok: false, enviado: false, erro: "Telefone inválido: " + telefone };
  }

  const config = await carregarConfigWhatsapp();

  if (!config.ativo || config.status !== "conectado" || !config.evolution) {
    const motivo = !config.ativo ? "desativado" : !config.evolution ? "sem conexão configurada" : `status "${config.status}"`;
    console.log(
      `[whatsapp:stub] Mensagem NÃO enviada (${motivo}).\n` + `  Destino: ${numeroNormalizado}\n` + `  Mensagem: "${mensagem}"`,
    );
    return { ok: true, enviado: false };
  }

  const resultado = await enviarMensagemTexto(config.evolution, numeroNormalizado, mensagem, {
    min: config.delayMinSegundos,
    max: config.delayMaxSegundos,
  });

  return resultado.ok ? { ok: true, enviado: true } : { ok: false, enviado: false, erro: resultado.erro };
}
