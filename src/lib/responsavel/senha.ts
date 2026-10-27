import "server-only";

import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

// scrypt nativo do Node (módulo "crypto" da stdlib) — NÃO é dependência externa. Confirmado em
// package.json (sem bcrypt/argon2 instalado) antes de escolher: scrypt é a opção recomendada pela
// própria documentação do Node para hash de senha quando não há bcrypt disponível (custo
// computacional ajustável, resistente a ataque por GPU, já embutido no runtime do Next/Vercel).
//
// Formato salvo em responsaveis.senha_hash: "<salt hex>:<hash hex>" — salt de 16 bytes por
// registro, nunca reaproveitado, gerado com o CSPRNG do Node.
const KEYLEN = 64;

function scryptAsync(senha: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, KEYLEN, (erro, chave) => {
      if (erro) reject(erro);
      else resolve(chave);
    });
  });
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const chave = await scryptAsync(senha, salt);
  return `${salt.toString("hex")}:${chave.toString("hex")}`;
}

// Nunca lança: hash malformado (ex.: responsavel antigo com valor inesperado) é tratado como
// "senha não confere", nunca como erro — quem chama decide a mensagem genérica de "CPF ou senha
// incorretos".
export async function verificarSenha(senha: string, hashSalvo: string): Promise<boolean> {
  const [saltHex, hashHex] = hashSalvo.split(":");
  if (!saltHex || !hashHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const hashEsperado = Buffer.from(hashHex, "hex");
    const chave = await scryptAsync(senha, salt);
    // timingSafeEqual exige buffers do mesmo tamanho — chave sempre tem KEYLEN bytes; só o hash
    // salvo pode divergir se o valor no banco estiver corrompido.
    if (chave.length !== hashEsperado.length) return false;
    return timingSafeEqual(chave, hashEsperado);
  } catch {
    return false;
  }
}

// 6 dígitos numéricos (000000–999999, com zeros à esquerda) — curto de propósito: o responsável
// é leigo, não é uma senha de admin. randomInt usa o CSPRNG do Node (não Math.random).
export function gerarSenhaNumerica(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
