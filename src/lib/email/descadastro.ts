import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Descadastro (opt-out) de e-mail marketing.
//
// TOKEN. O link de descadastro não pode expor o e-mail na URL nem permitir que alguém
// descadastre um endereço qualquer só sabendo o e-mail. Por isso o token é o e-mail
// CRIPTOGRAFADO e autenticado (AES-256-GCM, com uma chave derivada de um segredo do
// servidor): opaco pra quem vê o link, e impossível de forjar sem o segredo. (Um
// "base64(email + segredo)" seria reversível: qualquer um decodificaria e veria o
// segredo.) A chave vem de DESCADASTRO_SECRET; sem ela, de GATEWAYS_ENCRYPTION_KEY, e
// por último da chave de serviço do Supabase — mude de segredo com cuidado: os links
// já enviados deixam de funcionar.

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

function chave(): Buffer {
  const segredo = process.env.DESCADASTRO_SECRET || process.env.GATEWAYS_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!segredo) throw new Error("Nenhum segredo disponível para gerar links de descadastro.");
  // Deriva uma chave própria deste uso (o segredo em si nunca é a chave direta).
  return createHmac("sha256", segredo).update("descadastro-email-v1").digest();
}

export function gerarTokenDescadastro(email: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const cifrado = Buffer.concat([cifra.update(email.trim().toLowerCase(), "utf8"), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), cifrado]).toString("base64url");
}

// null = token inválido, adulterado ou de outro segredo.
export function lerTokenDescadastro(token: string): string | null {
  try {
    const bytes = Buffer.from(token, "base64url");
    if (bytes.length < 12 + 16 + 3) return null;
    const decifra = createDecipheriv("aes-256-gcm", chave(), bytes.subarray(0, 12));
    decifra.setAuthTag(bytes.subarray(12, 28));
    const email = Buffer.concat([decifra.update(bytes.subarray(28)), decifra.final()]).toString("utf8");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  } catch {
    return null;
  }
}

export function linkDescadastro(email: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO;
  return `${base}/descadastro/${gerarTokenDescadastro(email)}`;
}

// Rodapé obrigatório de todo e-mail de campanha (não faz parte do texto editável).
export function anexarRodapeDescadastro(html: string, link: string): string {
  const rodape = `<p style="text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#64748b;margin:24px 0 8px;">Para não receber mais e-mails de marketing, <a href="${link}" style="color:#64748b;">clique aqui</a>.</p>`;
  // Fragmento comum: vai no fim. Documento completo: entra antes de </body>.
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${rodape}</body>`) : `${html}\n${rodape}`;
}

// ===== Efeito no banco (usado pela página pública e pela tela do admin) =====

// LIKE sem curingas: "_" e "%" existem em e-mails válidos (fulano_x@...).
function literalParaIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function descadastrarEmail(email: string, motivo?: string | null): Promise<{ ok: boolean; erro?: string }> {
  const endereco = email.trim().toLowerCase();
  const admin = createAdminClient();

  // Todos os cadastros de aluno com esse e-mail (sem diferenciar maiúsculas).
  const { data: alunos, error: erroAlunos } = await admin
    .from("alunos")
    .select("id")
    .ilike("email", literalParaIlike(endereco));
  if (erroAlunos) return { ok: false, erro: "Não foi possível registrar o descadastro." };

  const { error: erroRegistro } = await admin
    .from("email_descadastros")
    .upsert({ email: endereco, aluno_id: alunos?.[0]?.id ?? null }, { onConflict: "email", ignoreDuplicates: true });
  if (erroRegistro) return { ok: false, erro: "Não foi possível registrar o descadastro." };

  if (motivo?.trim()) {
    await admin.from("email_descadastros").update({ motivo: motivo.trim().slice(0, 500) }).eq("email", endereco);
  }

  if (alunos?.length) {
    const { error } = await admin
      .from("alunos")
      .update({ email_marketing_ativo: false })
      .in("id", alunos.map((a) => a.id as string));
    if (error) return { ok: false, erro: "Não foi possível registrar o descadastro." };
  }
  return { ok: true };
}

// Desfaz: apaga o registro e reativa os alunos com esse e-mail.
export async function reativarEmail(email: string): Promise<{ ok: boolean; erro?: string }> {
  const endereco = email.trim().toLowerCase();
  const admin = createAdminClient();

  const { error: erroAlunos } = await admin
    .from("alunos")
    .update({ email_marketing_ativo: true })
    .ilike("email", literalParaIlike(endereco));
  if (erroAlunos) return { ok: false, erro: "Não foi possível reativar o e-mail." };

  const { error } = await admin.from("email_descadastros").delete().eq("email", endereco);
  if (error) return { ok: false, erro: "Não foi possível reativar o e-mail." };
  return { ok: true };
}
