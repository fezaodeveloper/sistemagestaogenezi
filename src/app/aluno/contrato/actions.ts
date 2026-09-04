"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { gerarContratoPdf } from "@/lib/contratos/pdf";
import { dispararEvento } from "@/lib/automacoes/motor";
import type { ContratoAssinado } from "@/lib/contratos/schema";

// Um aluno pode ter mais de uma matrícula (logo mais de um contrato) — a
// tela mostra o mais recente, mesma simplificação de escopo assumida em
// getMeusCertificados (não há uma tela de lista de contratos, só "o meu
// contrato").
export async function getContratoAluno(): Promise<ContratoAssinado | null> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("contratos_assinados")
    .select("*")
    .eq("aluno_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ContratoAssinado | null) ?? null;
}

export async function assinarContrato(matriculaId: string): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const agora = new Date();
  const dataFormatada = `${agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${agora.toLocaleTimeString(
    "pt-BR",
    { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" },
  )}`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("contratos_assinados")
    .update({
      status: "aceito",
      aceito_em: agora.toISOString(),
      aceito_ip: ip,
    })
    .eq("matricula_id", matriculaId)
    .eq("aluno_id", user.id);

  if (error) {
    return { error: "Não foi possível registrar a assinatura. Tente novamente." };
  }

  const { data: matriculaInfo } = await supabase
    .from("matriculas")
    .select("turmas(cursos(nome))")
    .eq("id", matriculaId)
    .single();
  const nomeCurso =
    (matriculaInfo as unknown as { turmas: { cursos: { nome: string } | null } | null } | null)?.turmas?.cursos
      ?.nome ?? "—";

  await dispararEvento(
    "contrato.assinado",
    { nome_aluno: user.full_name ?? user.email ?? "—", nome_curso: nomeCurso, matricula_id: matriculaId },
    `contrato-assinado-${matriculaId}`,
  );

  // Best-effort: regenera o PDF com o rodapé de aceite digital. Se falhar,
  // a assinatura já registrada acima continua válida — o aluno só ficaria
  // vendo o PDF sem o rodapé, e não o processo de assinatura em si.
  try {
    const pdfBuffer = await gerarContratoPdf(matriculaId, {
      assinatura: { nome: user.full_name ?? user.email ?? "—", dataFormatada },
    });
    await supabase
      .from("contratos_assinados")
      .update({ conteudo_pdf_base64: pdfBuffer.toString("base64") })
      .eq("matricula_id", matriculaId)
      .eq("aluno_id", user.id);
  } catch {
    // Best-effort — a assinatura já foi registrada com sucesso acima.
  }

  revalidatePath("/aluno/contrato");
  return {};
}
