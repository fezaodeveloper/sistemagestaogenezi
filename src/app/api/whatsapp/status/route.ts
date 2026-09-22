import "server-only";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarConfigWhatsapp } from "@/lib/whatsapp/config";
import { statusInstancia } from "@/lib/whatsapp/evolution";

// Sobe o tempo máximo de execução — statusInstancia() faz uma chamada HTTP à Evolution API
// (timeout de 20s, ver src/lib/whatsapp/evolution.ts) que precisa de espaço pra falhar de forma
// limpa (erro capturado) em vez de a Vercel matar a function no meio.
export const maxDuration = 30;

// Polling de status (a cada 5s pela tela) — GET, não POST: só consulta a Evolution API e
// atualiza o que mudou; não tem efeito colateral em cima de dados que o admin não pediu pra
// alterar. Só admin autenticado (mesmo padrão de /api/telegram/teste).
export async function GET() {
  await requireRole("admin");

  const config = await carregarConfigWhatsapp();
  if (!config.evolution) {
    return NextResponse.json({ ativo: config.ativo, status: config.status, numeroConectado: config.numeroConectado });
  }

  const resultado = await statusInstancia(config.evolution);
  if (!resultado.ok) {
    // A Evolution API não respondeu: mantém o último status conhecido em vez de mostrar erro a
    // cada 5s (transitório de rede não deve "piscar" a tela).
    return NextResponse.json({ ativo: config.ativo, status: config.status, numeroConectado: config.numeroConectado });
  }

  // Só grava se algo mudou (evita um UPDATE a cada 5s à toa).
  if (resultado.status !== config.status || resultado.numero !== config.numeroConectado) {
    await createAdminClient()
      .from("whatsapp_config")
      .update({ status: resultado.status, numero_conectado: resultado.numero })
      .eq("id", true);
  }

  return NextResponse.json({ ativo: config.ativo, status: resultado.status, numeroConectado: resultado.numero });
}
