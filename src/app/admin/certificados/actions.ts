"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dispararEvento } from "@/lib/automacoes/motor";

// Libera um ou vários certificados de uma vez (checkbox individual ou
// "selecionar todos" na fila) — o admin só destrava; quem gera o PDF a
// partir daqui é o próprio aluno, em emitirCertificadoProprio.
export async function liberarCertificados(ids: string[]): Promise<{ error?: string }> {
  await requireRole("admin");

  if (ids.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data: atualizados, error } = await supabase
    .from("certificados")
    .update({ liberado: true })
    .in("id", ids)
    .eq("liberado", false)
    .select(
      "id, frequencia_percentual, aproveitamento_percentual, matriculas(alunos(full_name), turmas(cursos(nome)))",
    );

  if (error) {
    return { error: "Não foi possível liberar os certificados selecionados." };
  }

  try {
    const certificadosLiberados = (atualizados ?? []) as unknown as {
      id: string;
      frequencia_percentual: number | null;
      aproveitamento_percentual: number | null;
      matriculas: {
        alunos: { full_name: string | null } | null;
        turmas: { cursos: { nome: string } | null } | null;
      } | null;
    }[];

    for (const certificado of certificadosLiberados) {
      await dispararEvento(
        "certificado.emitido",
        {
          nome_aluno: certificado.matriculas?.alunos?.full_name ?? "—",
          nome_curso: certificado.matriculas?.turmas?.cursos?.nome ?? "—",
          frequencia: certificado.frequencia_percentual ?? "—",
          nota: certificado.aproveitamento_percentual ?? "—",
        },
        `certificado-emitido-${certificado.id}`,
      );
    }
  } catch {
    // Best-effort — os certificados já foram liberados com sucesso acima.
  }

  revalidatePath("/admin/certificados");
  revalidatePath("/admin");
  return {};
}
