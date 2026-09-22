"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import { carregarConfigWhatsapp } from "@/lib/whatsapp/config";
import { desconectarInstancia, enviarMensagemTexto } from "@/lib/whatsapp/evolution";
import { normalizarTelefone } from "@/lib/mensagens/texto";
import { isWhatsappTemplateId, placeholdersDesconhecidos, WHATSAPP_TEMPLATES } from "@/lib/whatsapp/templates";

type Resultado = { success: true } | { error: string };

function revalidar() {
  revalidatePath("/admin/configuracoes/whatsapp");
}

// ===== Seção "Conexão" =====

export type DadosConexaoForm = {
  url: string;
  // Vazio = manter a chave salva (a tela nunca mostra o valor de volta).
  apiKey: string;
  instancia: string;
  ativo: boolean;
};

const conexaoSchema = z.object({
  url: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/[^\s"'()\\<>]+$/.test(v), { error: "URL inválida (use http(s)://...)." }),
  apiKey: z.string().trim().max(500),
  instancia: z
    .string()
    .trim()
    .max(100)
    .refine((v) => v === "" || /^[\w-]+$/.test(v), { error: "Use apenas letras, números, - e _ no nome da instância." }),
  ativo: z.boolean(),
});

export async function salvarConexaoWhatsapp(dadosBrutos: DadosConexaoForm): Promise<Resultado> {
  const user = await requireRole("admin");

  const parsed = conexaoSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  // Client admin: evolution_api_key não tem select pra authenticated (a atualização parcial —
  // "campo vazio = manter a chave atual" — precisa ler o valor salvo primeiro).
  const admin = createAdminClient();
  const { data: atual, error: erroLeitura } = await admin.from("whatsapp_config").select("evolution_api_key").eq("id", true).maybeSingle();
  if (erroLeitura) return { error: "Não foi possível ler a configuração. Confira se a migration whatsapp_genzap foi aplicada." };

  let apiKey: string | null = (atual?.evolution_api_key as string | null | undefined) ?? null;
  if (dados.apiKey) {
    try {
      apiKey = criptografar(dados.apiKey);
    } catch (erro) {
      if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
      return { error: "Não foi possível proteger a chave da API. Tente novamente." };
    }
  }

  if (dados.ativo && (!dados.url || !dados.instancia || !apiKey)) {
    return { error: "Preencha URL, instância e chave da API antes de ativar." };
  }

  const { error } = await admin
    .from("whatsapp_config")
    .update({
      evolution_api_url: dados.url || null,
      evolution_instance_name: dados.instancia || null,
      evolution_api_key: apiKey,
      ativo: dados.ativo,
      updated_by: user.id,
    })
    .eq("id", true);
  if (error) return { error: "Não foi possível salvar a configuração. Tente novamente." };

  revalidar();
  return { success: true };
}

// ===== Seção "Anti-banimento" =====

const delaysSchema = z
  .object({
    delayMinSegundos: z.number().int().min(1).max(10),
    delayMaxSegundos: z.number().int().min(1).max(30),
  })
  .refine((d) => d.delayMaxSegundos >= d.delayMinSegundos, { error: "O delay máximo não pode ser menor que o mínimo.", path: ["delayMaxSegundos"] });

export async function salvarAntiBanimento(dados: { delayMinSegundos: number; delayMaxSegundos: number }): Promise<Resultado> {
  await requireRole("admin");

  const parsed = delaysSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_config")
    .update({ delay_min_segundos: parsed.data.delayMinSegundos, delay_max_segundos: parsed.data.delayMaxSegundos })
    .eq("id", true);
  if (error) return { error: "Não foi possível salvar. Confira se a migration whatsapp_genzap foi aplicada." };

  revalidar();
  return { success: true };
}

// ===== Seção "Status da conexão" — desconectar =====

export async function desconectarWhatsapp(): Promise<Resultado> {
  await requireRole("admin");

  const config = await carregarConfigWhatsapp();
  if (config.evolution) {
    const resultado = await desconectarInstancia(config.evolution);
    // Segue mesmo se a Evolution API falhar (ex.: já estava desconectada do lado dela) — o
    // importante é a tela voltar a mostrar "desconectado".
    if (!resultado.ok) console.error("[whatsapp] falha ao desconectar na Evolution API:", resultado.erro);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("whatsapp_config").update({ status: "desconectado", numero_conectado: null }).eq("id", true);
  if (error) return { error: "Não foi possível atualizar o status. Tente novamente." };

  revalidar();
  return { success: true };
}

// ===== Seção "Teste de envio" =====

const testeSchema = z.object({
  telefone: z.string().trim().min(1, { error: "Informe o telefone com DDD." }),
  mensagem: z.string().trim().min(1, { error: "Escreva a mensagem." }).max(4096, { error: "Mensagem longa demais." }),
});

export async function enviarTesteWhatsapp(telefone: string, mensagem: string): Promise<{ ok: boolean; erro?: string }> {
  await requireRole("admin");

  // Blindagem extra: enviarMensagemTexto/carregarConfigWhatsapp já têm try/catch próprios e
  // nunca lançam, mas uma Server Action que lança vira um erro genérico do Next no client (o
  // formulário não teria como mostrar o texto real) — aqui garante {ok:false, erro} sempre,
  // não importa o que aconteça.
  try {
    const parsed = testeSchema.safeParse({ telefone, mensagem });
    if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    if (!normalizarTelefone(parsed.data.telefone)) {
      return { ok: false, erro: "Telefone inválido: informe DDD + número (ex.: 11999999999)." };
    }

    const config = await carregarConfigWhatsapp();
    if (!config.evolution) return { ok: false, erro: "Preencha e salve URL, instância e chave da API antes de testar." };
    if (config.status !== "conectado") return { ok: false, erro: "Conecte o WhatsApp (leia o QR Code) antes de enviar um teste." };

    // Ignora o toggle "Ativo" de propósito (mesmo espírito do "Enviar teste" da IntegraX): o
    // admin pode testar antes de ativar o envio automático pro resto do sistema. `delay: null`
    // pula a espera anti-banimento — um clique manual de teste não deve esperar até 30s antes
    // de sequer tentar enviar (ver o comentário em enviarMensagemTexto).
    const resultado = await enviarMensagemTexto(config.evolution, parsed.data.telefone, parsed.data.mensagem, null);
    if (!resultado.ok) {
      console.error("[whatsapp] Enviar teste falhou", { instancia: config.evolution.instancia, status: config.status, erro: resultado.erro });
    }
    return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro ?? "Não foi possível enviar a mensagem." };
  } catch (erro) {
    console.error("[whatsapp] Enviar teste — exceção inesperada na Server Action", erro);
    return { ok: false, erro: erro instanceof Error ? erro.message : "Erro inesperado ao enviar o teste. Veja os logs do servidor." };
  }
}

// ===== Aba "Templates" =====

const templateSchema = z.object({
  id: z.string().refine(isWhatsappTemplateId, { error: "Template inválido." }),
  mensagem: z
    .string()
    .trim()
    .min(1, { error: "Escreva a mensagem." })
    .max(1000, { error: "A mensagem pode ter no máximo 1000 caracteres." }),
  ativo: z.boolean(),
});

// Salva (ou atualiza) um template. `ativo` desligado = o sistema usa a mensagem padrão do
// código (o envio continua acontecendo — ver renderTemplate).
export async function salvarTemplateWhatsapp(dados: { id: string; mensagem: string; ativo: boolean }): Promise<Resultado> {
  await requireRole("admin");

  const parsed = templateSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, mensagem, ativo } = parsed.data;

  const definicao = WHATSAPP_TEMPLATES[id];
  const chaves = definicao.placeholders.map((p) => p.chave);
  const desconhecidos = placeholdersDesconhecidos(mensagem, chaves);
  if (desconhecidos.length > 0) {
    return { error: `Placeholder desconhecido: ${desconhecidos.map((c) => `{${c}}`).join(", ")}. Use só os da lista.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_templates")
    .upsert({ id, nome: definicao.nome, mensagem, ativo, variaveis: chaves }, { onConflict: "id" });
  if (error) return { error: "Não foi possível salvar o template. Confira se a migration whatsapp_templates foi aplicada." };

  revalidar();
  return { success: true };
}
