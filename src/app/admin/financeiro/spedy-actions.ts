"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { consultarNotaDaParcela, emitirNotaFiscalDaParcela, rotuloStatusSpedy } from "@/lib/spedy/nfe";

export type EmitirNotaResultado =
  | { success: true; notaId: string; status: string; numeroNota: number | null }
  | { error: string };

// Botão "Emitir NF" da parcela paga: emite AGORA (o admin confirmou no dialog).
export async function emitirNotaParcela(parcelaId: string): Promise<EmitirNotaResultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(parcelaId).success) return { error: "Parcela inválida." };

  const resultado = await emitirNotaFiscalDaParcela(parcelaId);
  if (!resultado.ok || !resultado.notaId) return { error: resultado.erro ?? "Não foi possível emitir a nota." };

  revalidatePath("/admin/financeiro");
  return {
    success: true,
    notaId: resultado.notaId,
    status: rotuloStatusSpedy(resultado.status),
    numeroNota: resultado.numeroNota ?? null,
  };
}

export type ConsultarNotaResultado =
  | { success: true; status: string; numeroNota: number | null; mensagem: string | null }
  | { error: string };

export async function consultarNotaParcela(parcelaId: string): Promise<ConsultarNotaResultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(parcelaId).success) return { error: "Parcela inválida." };

  const resultado = await consultarNotaDaParcela(parcelaId);
  if (!resultado.ok) return { error: resultado.erro ?? "Não foi possível consultar a nota." };
  return {
    success: true,
    status: rotuloStatusSpedy(resultado.status),
    numeroNota: resultado.numeroNota ?? null,
    mensagem: resultado.mensagem ?? null,
  };
}
