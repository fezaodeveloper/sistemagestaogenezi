"use server";

import { requireRole } from "@/lib/auth/dal";
import { carregarLogoEscolaParaPdf } from "@/lib/pdf/logo-escola";

// PDFs gerados no navegador (lista de alunos, comprovante de matrícula...)
// pedem o logo por aqui na hora de gerar. Só admin — todos esses PDFs saem
// de telas do painel admin.
export async function getLogoEscolaPdf(): Promise<string | null> {
  await requireRole("admin");
  return carregarLogoEscolaParaPdf();
}
