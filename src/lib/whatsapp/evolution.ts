import "server-only";

import { enviarWhatsapp as postSendText } from "@/lib/mensagens/evolution";
import { normalizarTelefone } from "@/lib/mensagens/texto";
import type { EvolutionInstanceConfig, WhatsappStatus } from "@/lib/whatsapp/config";

// Cliente da Evolution API pro GênZap (ciclo de vida da instância: criar, conectar/QR, status,
// desconectar). O ENVIO de texto em si (POST /message/sendText) já existe e é reaproveitado
// daqui (src/lib/mensagens/evolution.ts::enviarWhatsapp) — sem duplicar a chamada HTTP.
//
// ATENÇÃO — contrato exato da Evolution API a confirmar contra a instância real da VPS: existem
// duas grandes famílias de versão (v1/v2) com formatos de resposta ligeiramente diferentes pra
// /instance/connect e /instance/fetchInstances. O código abaixo segue o contrato passado na
// tarefa e faz o parsing das respostas de forma defensiva (aceita os formatos mais comuns de
// cada endpoint); se a instância real responder diferente, é só ajustar as funções de parsing
// (parseQrCode/parseStatusInstancia) sem mexer no resto do sistema.

const TIMEOUT_MS = 15_000;

export type ResultadoEvolution = { ok: boolean; erro?: string };

function baseUrl(config: EvolutionInstanceConfig): string {
  return config.url.replace(/\/+$/, "");
}

function headersPadrao(config: EvolutionInstanceConfig): HeadersInit {
  return { "Content-Type": "application/json", Accept: "application/json", apikey: config.apiKey };
}

async function chamar(
  config: EvolutionInstanceConfig,
  metodo: string,
  caminho: string,
  corpo?: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; erro: string; status?: number }> {
  try {
    const resposta = await fetch(`${baseUrl(config)}${caminho}`, {
      method: metodo,
      headers: headersPadrao(config),
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      // Não segue redirecionamentos (não vaza a API key pra outro host).
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const corpoResposta = await resposta.text();
    const data = corpoResposta ? JSON.parse(corpoResposta) : null;

    if (resposta.status >= 200 && resposta.status < 300) return { ok: true, data };
    if (resposta.status === 401 || resposta.status === 403) {
      return { ok: false, erro: "A Evolution API recusou a chave (apikey inválida).", status: resposta.status };
    }
    const detalhe = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : corpoResposta.slice(0, 300);
    return { ok: false, erro: `Evolution API respondeu HTTP ${resposta.status}${detalhe ? `: ${detalhe}` : "."}`, status: resposta.status };
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "";
    const causa = (erro as { cause?: { code?: string } } | null)?.cause?.code;
    if (causa === "ENOTFOUND" || causa === "ECONNREFUSED") {
      return { ok: false, erro: "Não foi possível conectar à Evolution API. Confira a URL configurada." };
    }
    if (/timeout|aborted/i.test(mensagemErro)) {
      return { ok: false, erro: "A Evolution API não respondeu a tempo. Tente novamente." };
    }
    if (mensagemErro.includes("JSON")) {
      return { ok: false, erro: "A Evolution API devolveu uma resposta inesperada (não era JSON)." };
    }
    return { ok: false, erro: mensagemErro || "Falha ao chamar a Evolution API." };
  }
}

// a) Cria a instância na Evolution API. Chamado automaticamente por conectarInstancia() quando a
// instância ainda não existe (a Evolution recusa /connect nesse caso).
export async function criarInstancia(config: EvolutionInstanceConfig): Promise<ResultadoEvolution> {
  const r = await chamar(config, "POST", "/instance/create", {
    instanceName: config.instancia,
    apikey: config.apiKey,
    integration: "WHATSAPP-BAILEYS",
  });
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}

// b) Inicia a conexão e devolve o QR Code em base64 (já incluindo o prefixo "data:image/...",
// como a Evolution API costuma devolver — pronto pra ir direto num <img src>).
export async function conectarInstancia(
  config: EvolutionInstanceConfig,
): Promise<{ ok: true; qrCode: string | null } | { ok: false; erro: string }> {
  let r = await chamar(config, "GET", `/instance/connect/${encodeURIComponent(config.instancia)}`);

  // Instância ainda não existe na Evolution API: cria e tenta conectar de novo.
  if (!r.ok && r.status === 404) {
    const criada = await criarInstancia(config);
    if (!criada.ok) return { ok: false, erro: criada.erro ?? "Não foi possível criar a instância." };
    r = await chamar(config, "GET", `/instance/connect/${encodeURIComponent(config.instancia)}`);
  }

  if (!r.ok) return { ok: false, erro: r.erro };
  return { ok: true, qrCode: parseQrCode(r.data) };
}

function parseQrCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const base64 = d.base64 ?? (d.qrcode as Record<string, unknown> | undefined)?.base64 ?? d.qr ?? null;
  if (typeof base64 !== "string" || !base64) return null;
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

// c) Status atual da instância + número conectado (quando aberto). fetchInstances devolve TODAS
// as instâncias da Evolution API — filtra pela nossa.
export async function statusInstancia(
  config: EvolutionInstanceConfig,
): Promise<{ ok: true; status: WhatsappStatus; numero: string | null } | { ok: false; erro: string }> {
  const r = await chamar(config, "GET", `/instance/fetchInstances?instanceName=${encodeURIComponent(config.instancia)}`);
  if (!r.ok) return { ok: false, erro: r.erro };

  const lista = Array.isArray(r.data) ? r.data : [];
  const entrada = lista.find((item) => {
    const nome = nomeDaInstancia(item);
    return nome === config.instancia;
  });
  if (!entrada) return { ok: true, status: "desconectado", numero: null };

  return { ok: true, status: mapStatus(estadoBruto(entrada)), numero: numeroDaInstancia(entrada) };
}

function campo(objeto: unknown, chave: string): unknown {
  return objeto && typeof objeto === "object" ? (objeto as Record<string, unknown>)[chave] : undefined;
}

function nomeDaInstancia(item: unknown): string | undefined {
  const instance = campo(item, "instance");
  const nome = campo(item, "instanceName") ?? campo(item, "name") ?? campo(instance, "instanceName") ?? campo(instance, "name");
  return typeof nome === "string" ? nome : undefined;
}

function estadoBruto(item: unknown): string {
  const instance = campo(item, "instance");
  const estado =
    campo(item, "connectionStatus") ?? campo(item, "state") ?? campo(instance, "connectionStatus") ?? campo(instance, "state") ?? campo(instance, "status");
  return typeof estado === "string" ? estado.toLowerCase() : "";
}

function numeroDaInstancia(item: unknown): string | null {
  const instance = campo(item, "instance");
  const bruto = campo(item, "ownerJid") ?? campo(item, "owner") ?? campo(instance, "owner") ?? campo(item, "number") ?? campo(instance, "number");
  if (typeof bruto !== "string" || !bruto) return null;
  return bruto.split("@")[0].replace(/\D/g, "") || null;
}

function mapStatus(estado: string): WhatsappStatus {
  if (["open", "connected"].includes(estado)) return "conectado";
  if (["connecting", "qrcode", "qr"].includes(estado)) return "aguardando_qr";
  return "desconectado";
}

// d) Envia texto: normaliza o telefone (DDD + número -> 55DDDNUMERO, mesma regra usada pelo
// resto do projeto), aplica o delay anti-banimento e chama o envio já existente
// (src/lib/mensagens/evolution.ts) — sem duplicar a montagem do POST /message/sendText. Nunca
// lança: sempre volta { ok, erro? }.
export async function enviarMensagemTexto(
  config: EvolutionInstanceConfig,
  telefone: string,
  mensagem: string,
  delay: { min: number; max: number },
): Promise<ResultadoEvolution> {
  try {
    const numero = normalizarTelefone(telefone);
    if (!numero) return { ok: false, erro: "Telefone inválido: informe DDD + número (ex.: 11999999999)." };
    if (!mensagem.trim()) return { ok: false, erro: "A mensagem está vazia." };

    const minimo = Math.max(0, Math.min(delay.min, delay.max));
    const maximo = Math.max(minimo, delay.max);
    const esperaMs = Math.round((minimo + Math.random() * (maximo - minimo)) * 1000);
    if (esperaMs > 0) await new Promise((resolve) => setTimeout(resolve, esperaMs));

    const resultado = await postSendText({ url: config.url, instancia: config.instancia, apiKey: config.apiKey }, numero, mensagem);
    return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha ao enviar a mensagem." };
  }
}

// e) Desconecta (logout) a instância — o número continua pareado na Evolution API, só a sessão
// ativa é encerrada; conectar de novo pede um QR Code novo.
export async function desconectarInstancia(config: EvolutionInstanceConfig): Promise<ResultadoEvolution> {
  const r = await chamar(config, "DELETE", `/instance/logout/${encodeURIComponent(config.instancia)}`);
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}
