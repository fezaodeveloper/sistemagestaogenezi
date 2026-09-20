import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Criptografia das credenciais dos gateways guardadas em gateways_config.credenciais
// (AES-256-GCM: confidencialidade + detecção de adulteração). A chave vem do
// ambiente — nunca do banco, senão quem lê a tabela leria também a chave.
//
// Formato: "enc:v1:<iv>:<tag>:<texto cifrado>" (base64). Valor SEM o prefixo é
// tratado como texto puro (semente da migration / dado legado) e é
// recriptografado na próxima gravação.

const PREFIXO = "enc:v1:";

export class ChaveCriptografiaAusenteError extends Error {
  constructor() {
    super("Defina a variável de ambiente GATEWAYS_ENCRYPTION_KEY para salvar credenciais de gateways.");
    this.name = "ChaveCriptografiaAusenteError";
  }
}

export function chaveCriptografiaConfigurada(): boolean {
  return !!process.env.GATEWAYS_ENCRYPTION_KEY?.trim();
}

function obterChave(): Buffer {
  const segredo = process.env.GATEWAYS_ENCRYPTION_KEY?.trim();
  if (!segredo) throw new ChaveCriptografiaAusenteError();
  // SHA-256 do segredo: qualquer string vira uma chave de 32 bytes.
  return createHash("sha256").update(segredo).digest();
}

export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", obterChave(), iv);
  const cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return PREFIXO + [iv, tag, cifrado].map((parte) => parte.toString("base64")).join(":");
}

// Lança se o valor estiver cifrado e a chave for outra/estiver ausente — quem
// chama decide o que fazer (o carregador de config trata como "não preenchido").
export function descriptografar(valor: string): string {
  if (!valor.startsWith(PREFIXO)) return valor;
  const [iv, tag, cifrado] = valor
    .slice(PREFIXO.length)
    .split(":")
    .map((parte) => Buffer.from(parte, "base64"));
  const decifra = createDecipheriv("aes-256-gcm", obterChave(), iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(cifrado), decifra.final()]).toString("utf8");
}
