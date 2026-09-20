import "server-only";

import { createHmac } from "node:crypto";
import https from "node:https";
import {
  GatewayNaoConfiguradoError,
  GatewayTipo,
  type CobrancaParams,
  type CobrancaResult,
  type CobrancaStatus,
  type GatewayAdapter,
  type MetodoPagamento,
  type ResultadoTesteConexao,
  type StatusCobranca,
} from "@/lib/gateways/types";

// Adapter da Efí (Efí Bank / ex-Gerencianet). São DUAS APIs, com hosts e
// autenticações diferentes:
//
//  - API Pix   (pix.api.efipay.com.br): OAuth2 em POST /oauth/token e mTLS — o
//    certificado .p12 é exigido em TODA chamada, inclusive a do token (por isso as
//    requisições usam node:https com `pfx`; o fetch nativo não aceita certificado
//    de cliente). Cobrança PIX imediata: POST /v2/cob.
//  - API Cobranças (cobrancas.api.efipay.com.br): boleto e link de cartão. OAuth2 em
//    POST /v1/authorize, sem certificado. O host correto é "cobrancas.", não o
//    "api.efipay.com.br" simples.
//
// Cartão: cobrar cartão direto exige um payment_token gerado no NAVEGADOR do
// pagador (JS da Efí + payeeCode); neste fluxo server-side a cobrança de cartão é
// feita pelo LINK DE PAGAMENTO da Efí (charge + /link), que dispensa o payeeCode.
//
// Ids: cobrança PIX = txid (alfanumérico, 26–35 chars); boleto/cartão = charge_id
// numérico. cancelar/consultar distinguem pelo formato.
//
// A ligação com o sistema é a `referenciaExterna` (id da parcela): infoAdicionais
// no PIX e metadata.custom_id em boleto/cartão — o webhook usa isso pra achar a
// parcela (ver src/app/api/webhooks/efi/route.ts).

const HOST_PIX = { producao: "pix.api.efipay.com.br", homologacao: "pix-h.api.efipay.com.br" };
const HOST_COBRANCAS = { producao: "cobrancas.api.efipay.com.br", homologacao: "cobrancas-h.api.efipay.com.br" };
const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

export const EFI_INFO_REFERENCIA = "referencia";

export type EfiConfig = {
  clientId: string;
  clientSecret: string;
  chavePix: string;
  // Reservado: só o pagamento com cartão TOKENIZADO no navegador usa; o link de
  // pagamento (usado aqui) não precisa.
  payeeCode: string;
  certificadoP12: string;
  sandbox: boolean;
};

// Token dos webhooks: a Efí só oferece mTLS pra autenticar o webhook, e o mTLS
// termina no servidor que recebe (na Vercel não dá pra exigir certificado de
// cliente) — por isso o webhook é cadastrado com x-skip-mtls-checking e protegido
// por este token na URL, derivado do clientSecret (nada a mais pro admin guardar).
// Além disso o webhook nunca confia no corpo: reconsulta a cobrança na API.
export function tokenWebhookEfi(clientSecret: string): string {
  return createHmac("sha256", clientSecret).update("efi-webhook").digest("hex").slice(0, 32);
}

export function urlWebhookEfi(clientSecret: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO;
  return `${base}/api/webhooks/efi?token=${tokenWebhookEfi(clientSecret)}`;
}

const STATUS_PIX: Record<string, StatusCobranca> = {
  ATIVA: "pendente",
  CONCLUIDA: "paga",
  REMOVIDA_PELO_USUARIO_RECEBEDOR: "cancelada",
  REMOVIDA_PELO_PSP: "cancelada",
};

const STATUS_CHARGE: Record<string, StatusCobranca> = {
  new: "pendente",
  waiting: "pendente",
  identified: "pendente",
  approved: "pendente",
  link: "pendente",
  paid: "paga",
  settled: "paga",
  unpaid: "falhou",
  canceled: "cancelada",
  expired: "vencida",
  refunded: "estornada",
  contested: "estornada",
};

export function normalizarStatusEfiCharge(status: string): StatusCobranca {
  return STATUS_CHARGE[status] ?? "outro";
}

function dataEmBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// charge_id é numérico; txid PIX é alfanumérico de 26–35 caracteres.
function ehCharge(id: string): boolean {
  return /^\d{1,18}$/.test(id);
}

type Resposta = { status: number; corpo: unknown };

// HTTPS com certificado de cliente opcional (mTLS). Corpo JSON in/out.
function chamar(opcoes: {
  host: string;
  caminho: string;
  metodo: string;
  cabecalhos?: Record<string, string>;
  corpo?: unknown;
  pfx?: Buffer;
}): Promise<Resposta> {
  return new Promise((resolve, reject) => {
    const dados = opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo);
    const req = https.request(
      {
        host: opcoes.host,
        path: opcoes.caminho,
        method: opcoes.metodo,
        headers: {
          Accept: "application/json",
          ...(dados !== undefined ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dados) } : {}),
          ...opcoes.cabecalhos,
        },
        // Os certificados .p12 da Efí não têm senha.
        ...(opcoes.pfx ? { pfx: opcoes.pfx, passphrase: "" } : {}),
        timeout: 20_000,
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on("data", (parte: Buffer) => partes.push(parte));
        res.on("end", () => {
          const texto = Buffer.concat(partes).toString("utf8");
          let corpo: unknown = null;
          try {
            corpo = texto ? JSON.parse(texto) : null;
          } catch {
            corpo = texto;
          }
          resolve({ status: res.statusCode ?? 0, corpo });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (dados !== undefined) req.write(dados);
    req.end();
  });
}

function mensagemErro(resposta: Resposta): string {
  const c = resposta.corpo as Record<string, unknown> | string | null;
  if (c && typeof c === "object") {
    // API Pix: { nome, mensagem, violacoes: [{ razao }] }
    if (typeof c.mensagem === "string") {
      const violacoes = Array.isArray(c.violacoes) ? (c.violacoes as { razao?: string }[]).map((v) => v.razao).filter(Boolean) : [];
      return [c.mensagem, ...violacoes.slice(0, 2)].join(" — ");
    }
    // API Cobranças: { code, error, error_description: string | { property, message } }
    const descricao = c.error_description;
    if (typeof descricao === "string") return descricao;
    if (descricao && typeof descricao === "object" && "message" in descricao) return String((descricao as { message: unknown }).message);
    if (typeof c.error === "string") return c.error;
  }
  return `Erro na API da Efí (${resposta.status}).`;
}

// Cache dos tokens OAuth (por instância do servidor): o token dura 3600s (Pix) /
// 600s (Cobranças); renova 60s antes de vencer.
const tokens = new Map<string, { token: string; expiraEm: number }>();

export type NotificacaoEfi = {
  custom_id?: string | null;
  type?: string;
  status?: { current?: string; previous?: string };
  identifiers?: { charge_id?: number };
  created_at?: string;
};

export type CobPixEfi = {
  txid: string;
  status: string;
  valor?: { original?: string };
  infoAdicionais?: { nome?: string; valor?: string }[];
  pix?: { endToEndId?: string; horario?: string; valor?: string }[];
  loc?: { id?: number };
};

type ChargeEfi = {
  charge_id: number;
  status: string;
  total?: number;
  custom_id?: string | null;
  payment?: { method?: string; banking_billet?: { expire_at?: string; link?: string }; paid_at?: string };
  created_at?: string;
};

export class EfiAdapter implements GatewayAdapter {
  readonly tipo = GatewayTipo.Efi;

  constructor(private readonly config: EfiConfig) {}

  private get ambiente(): "producao" | "homologacao" {
    return this.config.sandbox ? "homologacao" : "producao";
  }

  private get pfx(): Buffer | undefined {
    const base64 = this.config.certificadoP12.replace(/\s+/g, "");
    return base64 ? Buffer.from(base64, "base64") : undefined;
  }

  private basic(): string {
    return `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`;
  }

  private exigirCredenciais(): void {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new GatewayNaoConfiguradoError("Efí sem Client ID/Client Secret configurados.");
    }
  }

  private exigirPix(): void {
    this.exigirCredenciais();
    if (!this.config.certificadoP12) {
      throw new GatewayNaoConfiguradoError("Efí sem certificado .p12: a API Pix exige o certificado em toda chamada.");
    }
  }

  private async token(api: "pix" | "cobrancas", renovar = false): Promise<string> {
    const chave = `${api}:${this.ambiente}:${this.config.clientId}`;
    const guardado = tokens.get(chave);
    if (!renovar && guardado && guardado.expiraEm > Date.now()) return guardado.token;

    const resposta =
      api === "pix"
        ? await chamar({
            host: HOST_PIX[this.ambiente],
            caminho: "/oauth/token",
            metodo: "POST",
            cabecalhos: { Authorization: this.basic() },
            corpo: { grant_type: "client_credentials" },
            pfx: this.pfx,
          })
        : await chamar({
            host: HOST_COBRANCAS[this.ambiente],
            caminho: "/v1/authorize",
            metodo: "POST",
            cabecalhos: { Authorization: this.basic() },
            corpo: { grant_type: "client_credentials" },
          });

    const dados = resposta.corpo as { access_token?: string; expires_in?: number } | null;
    if (resposta.status !== 200 || !dados?.access_token) {
      throw new Error(`Efí ${api === "pix" ? "(Pix)" : "(Cobranças)"}: ${mensagemErro(resposta)}`);
    }
    tokens.set(chave, { token: dados.access_token, expiraEm: Date.now() + Math.max(60, (dados.expires_in ?? 600) - 60) * 1000 });
    return dados.access_token;
  }

  private async pix<T>(metodo: string, caminho: string, corpo?: unknown, extra: Record<string, string> = {}): Promise<T> {
    this.exigirPix();
    for (const renovar of [false, true]) {
      const resposta = await chamar({
        host: HOST_PIX[this.ambiente],
        caminho,
        metodo,
        cabecalhos: { Authorization: `Bearer ${await this.token("pix", renovar)}`, ...extra },
        corpo,
        pfx: this.pfx,
      });
      // Token recusado (revogado antes do prazo): renova uma vez e repete.
      if (resposta.status === 401 && !renovar) continue;
      if (resposta.status < 200 || resposta.status >= 300) throw new Error(mensagemErro(resposta));
      return resposta.corpo as T;
    }
    throw new Error("Efí recusou a autenticação.");
  }

  private async cobrancas<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    this.exigirCredenciais();
    for (const renovar of [false, true]) {
      const resposta = await chamar({
        host: HOST_COBRANCAS[this.ambiente],
        caminho,
        metodo,
        cabecalhos: { Authorization: `Bearer ${await this.token("cobrancas", renovar)}` },
        corpo,
      });
      if (resposta.status === 401 && !renovar) continue;
      if (resposta.status < 200 || resposta.status >= 300) throw new Error(mensagemErro(resposta));
      return resposta.corpo as T;
    }
    throw new Error("Efí recusou a autenticação.");
  }

  // ===== Interface comum (GatewayAdapter) =====

  async testarConexao(): Promise<ResultadoTesteConexao> {
    if (!this.config.clientId || !this.config.clientSecret) {
      return { ok: false, erro: "Client ID e Client Secret são obrigatórios." };
    }
    try {
      // Obter o token OAuth = credenciais válidas. Cobranças (boleto/cartão) não usa certificado.
      await this.token("cobrancas", true);
      if (!this.config.certificadoP12) {
        return {
          ok: true,
          aviso: "Credenciais de Cobranças (boleto/cartão) válidas. Sem o certificado .p12 não dá para gerar PIX.",
        };
      }
      // Com certificado: testa também o mTLS da API Pix.
      await this.token("pix", true);
      return this.config.chavePix
        ? { ok: true }
        : { ok: true, aviso: "Conexão OK (Pix e Cobranças), mas falta a Chave PIX para gerar cobranças PIX." };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      if (/timeout/i.test(mensagem)) return { ok: false, erro: "A Efí não respondeu a tempo. Tente novamente." };
      if (/pfx|mac verify|unsupported|bad decrypt|asn1/i.test(mensagem)) {
        return { ok: false, erro: "Não foi possível ler o certificado .p12 (arquivo inválido ou formato antigo não suportado)." };
      }
      return { ok: false, erro: mensagem || "Falha ao conectar na Efí." };
    }
  }

  async gerarCobranca(params: CobrancaParams): Promise<CobrancaResult> {
    if (!(params.valor > 0)) throw new Error("O valor da cobrança deve ser maior que zero.");
    if (params.metodo === "pix") return this.gerarPix(params);
    if (params.metodo === "boleto") return this.gerarBoleto(params);
    return this.gerarLinkCartao(params);
  }

  async cancelarCobranca(id: string): Promise<void> {
    if (ehCharge(id)) {
      await this.cobrancas("PUT", `/v1/charge/${id}/cancel`);
      return;
    }
    // Cobrança PIX: remove (padrão BACEN, status REMOVIDA_PELO_USUARIO_RECEBEDOR).
    await this.pix("PATCH", `/v2/cob/${encodeURIComponent(id)}`, { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" });
  }

  async consultarCobranca(id: string): Promise<CobrancaStatus> {
    if (ehCharge(id)) {
      const resposta = await this.cobrancas<{ data: ChargeEfi }>("GET", `/v1/charge/${id}`);
      return this.chargeParaStatus(resposta.data);
    }
    const cob = await this.consultarCobPix(id);
    return {
      id: cob.txid,
      status: STATUS_PIX[cob.status] ?? "outro",
      statusOriginal: cob.status,
      valor: Number(cob.valor?.original ?? 0),
      dataPagamento: cob.pix?.[0]?.horario ? dataEmBrasilia(cob.pix[0].horario) : undefined,
      metodo: "pix",
    };
  }

  // ===== Específico da Efí =====

  async consultarCobPix(txid: string): Promise<CobPixEfi> {
    return this.pix<CobPixEfi>("GET", `/v2/cob/${encodeURIComponent(txid)}`);
  }

  // Detalhes de uma notificação de boleto/cartão (a Efí só envia um token).
  async consultarNotificacao(token: string): Promise<NotificacaoEfi[]> {
    const resposta = await this.cobrancas<{ data?: NotificacaoEfi[] }>("GET", `/v1/notification/${encodeURIComponent(token)}`);
    return resposta.data ?? [];
  }

  async metodoDoCharge(chargeId: string): Promise<MetodoPagamento | undefined> {
    const resposta = await this.cobrancas<{ data: ChargeEfi }>("GET", `/v1/charge/${chargeId}`);
    return this.metodoDoPayment(resposta.data.payment?.method);
  }

  // Cadastra (ou atualiza) o webhook PIX da chave. x-skip-mtls-checking: a Efí não
  // exige certificado de cliente no NOSSO servidor (ver tokenWebhookEfi). `ignorar=`
  // impede a Efí de anexar "/pix" ao fim da URL.
  async registrarWebhookPix(): Promise<void> {
    if (!this.config.chavePix) throw new GatewayNaoConfiguradoError("Efí sem Chave PIX configurada.");
    await this.pix(
      "PUT",
      `/v2/webhook/${encodeURIComponent(this.config.chavePix)}`,
      { webhookUrl: `${urlWebhookEfi(this.config.clientSecret)}&ignorar=` },
      { "x-skip-mtls-checking": "true" },
    );
  }

  private async gerarPix(params: CobrancaParams): Promise<CobrancaResult> {
    this.exigirPix();
    if (!this.config.chavePix) throw new GatewayNaoConfiguradoError("Efí sem Chave PIX configurada.");

    const documento = params.cliente.cpfCnpj.replace(/\D/g, "");
    const fim = new Date(`${params.vencimento}T23:59:59-03:00`).getTime();
    // Validade em segundos até o fim do vencimento (mín. 5 min; máx. 30 dias).
    const expiracao = Math.min(Math.max(Math.floor((fim - Date.now()) / 1000), 300), 30 * 24 * 60 * 60);

    const cob = await this.pix<CobPixEfi & { loc?: { id: number } }>("POST", "/v2/cob", {
      calendario: { expiracao },
      ...(documento.length === 11 || documento.length === 14
        ? { devedor: { [documento.length === 11 ? "cpf" : "cnpj"]: documento, nome: params.cliente.nome.slice(0, 200) } }
        : {}),
      valor: { original: params.valor.toFixed(2) },
      chave: this.config.chavePix,
      solicitacaoPagador: params.descricao.slice(0, 140),
      ...(params.referenciaExterna
        ? { infoAdicionais: [{ nome: EFI_INFO_REFERENCIA, valor: params.referenciaExterna }] }
        : {}),
    });

    let qrcode: { qrcode?: string; imagemQrcode?: string } = {};
    if (cob.loc?.id !== undefined) {
      qrcode = await this.pix<{ qrcode?: string; imagemQrcode?: string }>("GET", `/v2/loc/${cob.loc.id}/qrcode`);
    }

    return {
      id: cob.txid,
      status: STATUS_PIX[cob.status] ?? "pendente",
      pixCopiaECola: qrcode.qrcode,
      // Já vem como data URI (imagem PNG em base64).
      pixQrCodeUrl: qrcode.imagemQrcode,
    };
  }

  private metadadosCobranca(params: CobrancaParams): Record<string, string> {
    return {
      ...(params.referenciaExterna ? { custom_id: params.referenciaExterna } : {}),
      // A Efí avisa mudanças de status aqui (POST com um token; ver o webhook).
      notification_url: urlWebhookEfi(this.config.clientSecret),
    };
  }

  private itens(params: CobrancaParams): { name: string; value: number; amount: number }[] {
    // Valor em centavos.
    return [{ name: params.descricao.slice(0, 255) || "Cobrança", value: Math.round(params.valor * 100), amount: 1 }];
  }

  private async gerarBoleto(params: CobrancaParams): Promise<CobrancaResult> {
    const documento = params.cliente.cpfCnpj.replace(/\D/g, "");
    const telefone = (params.cliente.telefone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    const cliente: Record<string, unknown> = {
      ...(documento.length > 11
        ? { juridical_person: { corporate_name: params.cliente.nome.slice(0, 100), cnpj: documento } }
        : { name: params.cliente.nome.slice(0, 100), cpf: documento }),
      ...(params.cliente.email ? { email: params.cliente.email } : {}),
      ...(telefone.length >= 10 ? { phone_number: telefone } : {}),
    };

    const resposta = await this.cobrancas<{
      data: { charge_id: number; status: string; link?: string; billet_link?: string; pdf?: { charge?: string }; barcode?: string };
    }>("POST", "/v1/charge/one-step", {
      items: this.itens(params),
      metadata: this.metadadosCobranca(params),
      payment: {
        banking_billet: {
          customer: cliente,
          expire_at: params.vencimento,
          message: params.descricao.slice(0, 80),
        },
      },
    });

    const dados = resposta.data;
    return {
      id: String(dados.charge_id),
      status: normalizarStatusEfiCharge(dados.status),
      urlBoleto: dados.pdf?.charge ?? dados.link ?? dados.billet_link,
      urlPagamento: dados.link ?? dados.billet_link,
    };
  }

  // Cartão (e "indefinido"): cria a cobrança e gera o link de pagamento hospedado.
  private async gerarLinkCartao(params: CobrancaParams): Promise<CobrancaResult> {
    const criada = await this.cobrancas<{ data: { charge_id: number; status: string } }>("POST", "/v1/charge", {
      items: this.itens(params),
      metadata: this.metadadosCobranca(params),
    });
    const chargeId = criada.data.charge_id;

    const link = await this.cobrancas<{ data: { payment_url?: string } }>("POST", `/v1/charge/${chargeId}/link`, {
      billet_discount: 0,
      card_discount: 0,
      message: params.descricao.slice(0, 80),
      expire_at: params.vencimento,
      request_delivery_address: false,
      payment_method: params.metodo === "cartao" ? "credit_card" : "all",
    });

    return {
      id: String(chargeId),
      status: "pendente",
      urlPagamento: link.data.payment_url,
    };
  }

  private metodoDoPayment(metodo: string | undefined): MetodoPagamento | undefined {
    if (metodo === "credit_card") return "cartao";
    if (metodo === "banking_billet") return "boleto";
    return undefined;
  }

  private chargeParaStatus(charge: ChargeEfi): CobrancaStatus {
    const vencimento = charge.payment?.banking_billet?.expire_at;
    return {
      id: String(charge.charge_id),
      status: normalizarStatusEfiCharge(charge.status),
      statusOriginal: charge.status,
      valor: (charge.total ?? 0) / 100,
      vencimento: vencimento || undefined,
      dataPagamento: charge.payment?.paid_at ? dataEmBrasilia(charge.payment.paid_at) : undefined,
      metodo: this.metodoDoPayment(charge.payment?.method),
      urlPagamento: charge.payment?.banking_billet?.link,
    };
  }
}
