import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderizarTemplateWhatsapp, WHATSAPP_TEMPLATES, type WhatsappTemplateId } from "@/lib/whatsapp/templates";

// Acesso ao banco pros templates de WhatsApp — separado de templates.ts (que não tem
// "server-only": é importado por um client component pra prévia/edição no navegador).

// Texto do template salvo no banco: só se existir E estiver ativo; senão o padrão do código
// (template inativo/tabela ausente = mesmo comportamento). Nunca lança.
export async function getTemplate(id: WhatsappTemplateId): Promise<string> {
  try {
    const { data, error } = await createAdminClient().from("whatsapp_templates").select("mensagem, ativo").eq("id", id).maybeSingle();
    if (!error && data && data.ativo === true && typeof data.mensagem === "string" && data.mensagem.trim()) {
      return data.mensagem;
    }
  } catch {
    // Cai no padrão.
  }
  return WHATSAPP_TEMPLATES[id].padrao;
}

// Busca o template (ativo, senão o padrão do código) e substitui os placeholders. Ponto único
// usado por todos os disparos automáticos (src/lib/whatsapp/eventos.ts) e por
// src/lib/mensagens/mensagens.ts.
export async function renderTemplate(id: WhatsappTemplateId, valores: Record<string, string>): Promise<string> {
  const modelo = await getTemplate(id);
  return renderizarTemplateWhatsapp(modelo, valores);
}
