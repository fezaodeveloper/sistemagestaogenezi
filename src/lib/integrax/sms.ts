import "server-only";

import { carregarConfigSms } from "@/lib/integrax/config";

// Envio de SMS pela IntegraX.
//
// ATENÇÃO — contrato da API a confirmar com o suporte da IntegraX: o host
// api.integrax.com.br informado na especificação NÃO resolve no DNS (ENOTFOUND) e
// não há documentação pública do endpoint. Foi assumido: POST {URL} com
// Authorization: Bearer <token> e corpo JSON { telefone, mensagem }. Se o contrato
// real for outro, é só ajustar URL/corpo aqui (ou definir INTEGRAX_SMS_URL); o
// botão "Enviar teste" da tela mostra o erro exato devolvido.

const INTEGRAX_URL_PADRAO = "https://api.integrax.com.br/sms";
const TIMEOUT_MS = 15_000;

export const SMS_LIMITE_CARACTERES = 160;

export type ResultadoSms = {
  ok: boolean;
  // false quando a integração não está configurada/ativa (nada foi enviado) — o
  // envio "não configurado" NÃO é erro (ok: true), pra nunca quebrar o fluxo que chamou.
  enviado: boolean;
  erro?: string;
};

// Só GSM-7 cabe em 160 caracteres por SMS; um único "ã" ou "ê" muda o SMS pra
// UCS-2 (70 por parte). Tira acentos e troca aspas/travessões "inteligentes".
export function normalizarTextoSms(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Só números, DDD + número (10 ou 11 dígitos). Aceita "+55 (11) 99999-9999".
export function normalizarTelefoneSms(telefone: string): string | null {
  let digitos = telefone.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  if (digitos.startsWith("0")) return null;
  return digitos;
}

function prepararMensagem(mensagem: string): string {
  const texto = normalizarTextoSms(mensagem);
  if (texto.length <= SMS_LIMITE_CARACTERES) return texto;
  console.warn(`[integrax] mensagem com ${texto.length} caracteres cortada em ${SMS_LIMITE_CARACTERES}.`);
  return `${texto.slice(0, SMS_LIMITE_CARACTERES - 3)}...`;
}

// Nunca lança. `ignorarAtivo`: usado só pelo "Enviar teste" da tela (exige token
// salvo, mas funciona com a integração desligada).
export async function enviarSMS(
  telefone: string,
  mensagem: string,
  opcoes: { ignorarAtivo?: boolean } = {},
): Promise<ResultadoSms> {
  try {
    const destino = normalizarTelefoneSms(telefone);
    if (!destino) return { ok: false, enviado: false, erro: "Telefone inválido: informe DDD + número (ex.: 11999999999)." };

    const texto = prepararMensagem(mensagem);
    if (!texto) return { ok: false, enviado: false, erro: "A mensagem está vazia." };

    const config = await carregarConfigSms();
    const configurado = !!config.token && (config.ativo || opcoes.ignorarAtivo === true);

    if (!configurado) {
      // Stub: mostra exatamente o que SERIA enviado.
      const motivo = !config.token ? "sem token salvo" : "integração desativada";
      console.log(
        `[integrax:stub] SMS NÃO enviado (${motivo}).\n` +
          `  Destino: ${destino}\n` +
          `  Tamanho: ${texto.length}/${SMS_LIMITE_CARACTERES} caracteres\n` +
          `  Mensagem: "${texto}"`,
      );
      if (opcoes.ignorarAtivo) {
        return { ok: false, enviado: false, erro: "Salve o token da API antes de enviar um teste." };
      }
      return { ok: true, enviado: false };
    }

    const resposta = await fetch(process.env.INTEGRAX_SMS_URL || INTEGRAX_URL_PADRAO, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ telefone: destino, mensagem: texto }),
      // Não segue redirecionamentos (não vaza o token pra outro host).
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (resposta.status >= 200 && resposta.status < 300) return { ok: true, enviado: true };

    const corpo = (await resposta.text().catch(() => "")).slice(0, 300);
    if (resposta.status === 401 || resposta.status === 403) {
      return {
        ok: false,
        enviado: false,
        erro: "A IntegraX recusou o token (inválido ou ainda não ativado pelo suporte).",
      };
    }
    return { ok: false, enviado: false, erro: `IntegraX respondeu HTTP ${resposta.status}${corpo ? `: ${corpo}` : "."}` };
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "";
    const causa = (erro as { cause?: { code?: string } } | null)?.cause?.code;
    if (causa === "ENOTFOUND") {
      return { ok: false, enviado: false, erro: "Não foi possível encontrar o servidor da IntegraX (host não resolve). Confirme o endereço da API com o suporte." };
    }
    if (/timeout|aborted/i.test(mensagemErro)) {
      return { ok: false, enviado: false, erro: "A IntegraX não respondeu a tempo. Tente novamente." };
    }
    return { ok: false, enviado: false, erro: mensagemErro || "Falha ao enviar o SMS." };
  }
}
