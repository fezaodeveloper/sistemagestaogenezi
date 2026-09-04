"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularRelatorioMEI } from "@/lib/mei/relatorio";
import { gerarRelatorioMEIPdf } from "@/lib/mei/pdf";

export async function gerarRelatorioMEI(ano: number, mes: number): Promise<{ pdf: string } | { error: string }> {
  await requireRole("admin");

  const supabase = await createClient();

  try {
    const relatorio = await calcularRelatorioMEI(ano, mes, supabase);
    const pdfBuffer = await gerarRelatorioMEIPdf(relatorio);
    return { pdf: pdfBuffer.toString("base64") };
  } catch {
    return { error: "Não foi possível gerar o relatório MEI. Tente novamente." };
  }
}
