import "server-only";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarConfigWhatsapp } from "@/lib/whatsapp/config";
import { conectarInstancia, statusInstancia } from "@/lib/whatsapp/evolution";

// Gera (ou renova) o QR Code — chamado ao clicar "Conectar / Gerar QR Code" e de novo a cada 30s
// enquanto a tela aguarda a leitura (o QR da Evolution API expira). Só admin autenticado.
export async function POST() {
  await requireRole("admin");

  const config = await carregarConfigWhatsapp();
  if (!config.evolution) {
    return NextResponse.json({ error: "Preencha URL, instância e chave da API antes de conectar." }, { status: 400 });
  }

  const resultado = await conectarInstancia(config.evolution);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.erro }, { status: 502 });
  }

  const admin = createAdminClient();

  // Sem QR na resposta: normalmente a sessão já estava conectada (reconexão automática) — confere
  // o status real antes de decidir o que gravar.
  if (!resultado.qrCode) {
    const status = await statusInstancia(config.evolution);
    const atual = status.ok ? status.status : "aguardando_qr";
    const numero = status.ok ? status.numero : null;
    await admin.from("whatsapp_config").update({ status: atual, numero_conectado: numero }).eq("id", true);
    return NextResponse.json({ qrCode: null, status: atual, numeroConectado: numero });
  }

  await admin.from("whatsapp_config").update({ status: "aguardando_qr", numero_conectado: null }).eq("id", true);
  return NextResponse.json({ qrCode: resultado.qrCode, status: "aguardando_qr", numeroConectado: null });
}
