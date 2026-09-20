"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import {
  carregarConfigEmail,
  EMAIL_CONFIG_ID,
  invalidarCacheEmail,
  type ConfigEmail,
  type ProvedorEmail,
} from "@/lib/email/config";
import { emailConfigurado, enviarEmail, testarProvedor, type ResultadoTesteProvedor } from "@/lib/email/provedor";
import { htmlParaTexto, renderizarTexto } from "@/lib/email/renderizar";
import { getTemplatePadrao, isEmailTemplateId } from "@/lib/email/templates-padrao";

// ===== Provedor =====

export type DadosProvedorForm =
  | { provedor: "resend"; apiKey: string; fromName: string; fromEmail: string }
  | { provedor: "sendgrid"; apiKey: string; fromName: string; fromEmail: string }
  | {
      provedor: "smtp";
      host: string;
      porta: number;
      usuario: string;
      // Vazia = manter a senha salva.
      senha: string;
      ssl: boolean;
      fromName: string;
      fromEmail: string;
    };

const emailOpcional = z.union([z.literal(""), z.email({ error: "E-mail do remetente inválido." })]);
const nomeOpcional = z.string().trim().max(100, { error: "Nome do remetente longo demais." });
const segredoSchema = z.string().max(4000, { error: "Credencial longa demais." });

const provedorSchema = z.discriminatedUnion("provedor", [
  z.object({ provedor: z.literal("resend"), apiKey: segredoSchema, fromName: nomeOpcional, fromEmail: emailOpcional }),
  z.object({ provedor: z.literal("sendgrid"), apiKey: segredoSchema, fromName: nomeOpcional, fromEmail: emailOpcional }),
  z.object({
    provedor: z.literal("smtp"),
    host: z.string().trim().max(255, { error: "Host longo demais." }),
    porta: z.number({ error: "Informe a porta." }).int().min(1, { error: "Porta inválida." }).max(65535, { error: "Porta inválida." }),
    usuario: z.string().trim().max(255),
    senha: segredoSchema,
    ssl: z.boolean(),
    fromName: nomeOpcional,
    fromEmail: emailOpcional,
  }),
]);

// Config final = a salva (já descriptografada) com o que o admin digitou por cima
// (segredo em branco mantém o salvo).
function mesclar(salva: ConfigEmail | null, dados: z.infer<typeof provedorSchema>): ConfigEmail {
  const base: ConfigEmail = salva ?? {
    provedor: "resend",
    resend: { apiKey: "", fromName: "", fromEmail: "" },
    smtp: { host: "", porta: 587, usuario: "", senha: "", ssl: true, fromName: "", fromEmail: "" },
    sendgrid: { apiKey: "", fromName: "", fromEmail: "" },
  };
  if (dados.provedor === "resend") {
    return { ...base, resend: { apiKey: dados.apiKey.trim() || base.resend.apiKey, fromName: dados.fromName, fromEmail: dados.fromEmail } };
  }
  if (dados.provedor === "sendgrid") {
    return { ...base, sendgrid: { apiKey: dados.apiKey.trim() || base.sendgrid.apiKey, fromName: dados.fromName, fromEmail: dados.fromEmail } };
  }
  return {
    ...base,
    smtp: {
      host: dados.host,
      porta: dados.porta,
      usuario: dados.usuario,
      senha: dados.senha || base.smtp.senha,
      ssl: dados.ssl,
      fromName: dados.fromName,
      fromEmail: dados.fromEmail,
    },
  };
}

export type SalvarProvedorResultado = { success: true } | { error: string };

export async function salvarProvedor(dadosBrutos: DadosProvedorForm, usar: boolean): Promise<SalvarProvedorResultado> {
  await requireRole("admin");

  const parsed = provedorSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const salva = await carregarConfigEmail({ semCache: true });
  const final = mesclar(salva, dados);

  // Só dá pra tornar "em uso" um provedor com o mínimo pra enviar.
  if (usar) {
    const faltando =
      dados.provedor === "resend"
        ? !final.resend.apiKey && !process.env.RESEND_API_KEY
          ? "Informe a API Key do Resend (ou mantenha RESEND_API_KEY no ambiente)."
          : null
        : dados.provedor === "sendgrid"
          ? !final.sendgrid.apiKey || !final.sendgrid.fromEmail
            ? "Informe a API Key e o e-mail do remetente do SendGrid."
            : null
          : !final.smtp.host || !final.smtp.fromEmail
            ? "Informe o servidor SMTP e o e-mail do remetente."
            : null;
    if (faltando) return { error: faltando };
  }

  // Colunas: só as do provedor editado; segredo em branco não é tocado.
  const campos: Record<string, unknown> = { id: EMAIL_CONFIG_ID };
  try {
    if (dados.provedor === "resend") {
      campos.resend_from_name = dados.fromName || null;
      campos.resend_from_email = dados.fromEmail || null;
      if (dados.apiKey.trim()) campos.resend_api_key = criptografar(dados.apiKey.trim());
    } else if (dados.provedor === "sendgrid") {
      campos.sendgrid_from_name = dados.fromName || null;
      campos.sendgrid_from_email = dados.fromEmail || null;
      if (dados.apiKey.trim()) campos.sendgrid_api_key = criptografar(dados.apiKey.trim());
    } else {
      campos.smtp_host = dados.host || null;
      campos.smtp_porta = dados.porta;
      campos.smtp_usuario = dados.usuario || null;
      campos.smtp_ssl = dados.ssl;
      campos.smtp_from_name = dados.fromName || null;
      campos.smtp_from_email = dados.fromEmail || null;
      if (dados.senha) campos.smtp_senha = criptografar(dados.senha);
    }
  } catch (erro) {
    if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
    return { error: "Não foi possível proteger a credencial. Tente novamente." };
  }
  if (usar) campos.provedor = dados.provedor;

  const supabase = await createClient();
  const { error } = await supabase.from("email_config").upsert(campos, { onConflict: "id" });
  if (error) return { error: "Não foi possível salvar. Confira se a migration email_config foi aplicada." };

  invalidarCacheEmail();
  revalidatePath("/admin/configuracoes/email");
  return { success: true };
}

export async function testarProvedorEmail(dadosBrutos: DadosProvedorForm): Promise<ResultadoTesteProvedor> {
  await requireRole("admin");

  const parsed = provedorSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = mesclar(await carregarConfigEmail({ semCache: true }), parsed.data);
  return testarProvedor(parsed.data.provedor as ProvedorEmail, config);
}

// ===== Templates =====

const templateSchema = z.object({
  assunto: z.string().trim().min(1, { error: "Informe o assunto." }).max(300, { error: "Assunto longo demais." }),
  corpoHtml: z.string().trim().min(1, { error: "O corpo do e-mail não pode ficar vazio." }).max(100_000, { error: "Corpo longo demais." }),
  ativo: z.boolean(),
});

export async function salvarTemplate(id: string, dados: { assunto: string; corpoHtml: string; ativo: boolean }): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!isEmailTemplateId(id)) return { error: "Template inválido." };

  const parsed = templateSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const padrao = getTemplatePadrao(id);
  const supabase = await createClient();
  // upsert: se a linha ainda não existir (migration sem a semente), ela é criada.
  const { error } = await supabase.from("email_templates").upsert(
    {
      id,
      nome: padrao.nome,
      assunto: parsed.data.assunto,
      corpo_html: parsed.data.corpoHtml,
      variaveis: padrao.variaveis,
      ativo: parsed.data.ativo,
    },
    { onConflict: "id" },
  );
  if (error) return { error: "Não foi possível salvar o template. Confira se a migration email_templates foi aplicada." };

  revalidatePath("/admin/configuracoes/email");
  return {};
}

export async function restaurarTemplate(id: string): Promise<{ error?: string } | { assunto: string; corpoHtml: string }> {
  await requireRole("admin");
  if (!isEmailTemplateId(id)) return { error: "Template inválido." };

  const padrao = getTemplatePadrao(id);
  const supabase = await createClient();
  const { error } = await supabase.from("email_templates").upsert(
    { id, nome: padrao.nome, assunto: padrao.assunto, corpo_html: padrao.corpo_html, variaveis: padrao.variaveis, ativo: true },
    { onConflict: "id" },
  );
  if (error) return { error: "Não foi possível restaurar o template." };

  revalidatePath("/admin/configuracoes/email");
  return { assunto: padrao.assunto, corpoHtml: padrao.corpo_html };
}

// Envia o que está no EDITOR (mesmo sem salvar), com valores de exemplo, pelo provedor em uso.
export async function enviarEmailTeste(
  id: string,
  destinatario: string,
  assunto: string,
  corpoHtml: string,
): Promise<{ ok: boolean; erro?: string }> {
  await requireRole("admin");
  if (!isEmailTemplateId(id)) return { ok: false, erro: "Template inválido." };
  if (!z.email().safeParse(destinatario.trim()).success) return { ok: false, erro: "Informe um e-mail de destino válido." };
  if (!assunto.trim() || !corpoHtml.trim()) return { ok: false, erro: "Assunto e corpo não podem ficar vazios." };
  if (!(await emailConfigurado())) return { ok: false, erro: "O provedor de e-mail em uso não está configurado." };

  const padrao = getTemplatePadrao(id);
  const html = renderizarTexto(corpoHtml, padrao.exemplo, padrao.variaveis, { escapar: true });
  const resultado = await enviarEmail({
    para: destinatario.trim(),
    assunto: `[TESTE] ${renderizarTexto(assunto, padrao.exemplo, padrao.variaveis, { escapar: false })}`,
    html,
    texto: htmlParaTexto(html),
  });
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro ?? "Não foi possível enviar." };
}
