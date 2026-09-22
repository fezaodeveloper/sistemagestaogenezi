import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";

// GênZap Fase 2: os 4 templates editados aqui (matrícula criada, lembrete de aula, falta,
// recontato de lead) migraram pra whatsapp_templates, unificados com os outros 9 templates de
// WhatsApp em Configurações > WhatsApp > Templates (ver a migration e
// src/lib/whatsapp/templates.ts). Esta rota só redireciona pra lá — mantém qualquer link/favorito
// antigo funcionando.
export default async function WhatsappConfiguracaoPage() {
  await requireRole("admin");
  redirect("/admin/configuracoes/whatsapp?aba=templates");
}
