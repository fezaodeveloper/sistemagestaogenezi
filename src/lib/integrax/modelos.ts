import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderizarSms, SMS_TEMPLATES, type SmsTemplateId } from "@/lib/integrax/templates";

// Nome da escola pro placeholder {nome_escola}. Nunca lança.
export async function nomeEscolaParaSms(): Promise<string> {
  try {
    const { data } = await createAdminClient().from("configuracoes").select("escola_nome").eq("id", true).maybeSingle();
    return (data?.escola_nome as string | null | undefined)?.trim() || "GENEZI";
  } catch {
    return "GENEZI";
  }
}

// Texto do template: o editado em Configurações > IntegraX > Templates quando existe E está ativo;
// caso contrário (template inativo, linha ausente, tabela ainda não criada, erro de banco) o
// padrão do código — exatamente a mensagem que o sistema enviava antes dos templates. Nunca lança.
async function modeloDoTemplate(id: SmsTemplateId): Promise<string> {
  try {
    const { data, error } = await createAdminClient().from("sms_templates").select("mensagem, ativo").eq("id", id).maybeSingle();
    if (!error && data && data.ativo === true && typeof data.mensagem === "string" && data.mensagem.trim()) {
      return data.mensagem;
    }
  } catch {
    // Cai no padrão.
  }
  return SMS_TEMPLATES[id].padrao;
}

// Monta a mensagem final de um evento: busca o template, substitui os placeholders e garante o
// teto de 160 caracteres abreviando as variáveis "encurtáveis" do evento.
export async function montarMensagemSms(id: SmsTemplateId, valores: Record<string, string>): Promise<string> {
  const modelo = await modeloDoTemplate(id);
  const completos = { ...valores };
  if (!("nome_escola" in completos) && modelo.includes("{nome_escola}")) {
    completos.nome_escola = await nomeEscolaParaSms();
  }
  return renderizarSms(modelo, completos, SMS_TEMPLATES[id].encurtaveis);
}
