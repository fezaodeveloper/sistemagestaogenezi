"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getExpiracaoMatricula, getMatriculaAtivaComTurma } from "@/lib/matriculas/access";
import { getLiberacaoAulasCurso } from "@/lib/cronograma/liberacao";
import { verificarEmissaoAutomaticaEad } from "@/lib/certificados/emitir";

const PDF_SIGNED_URL_EXPIRES_IN = 600; // 10 minutos

// Gerada sob demanda (só quando o aluno clica em "ver material"), não no
// carregamento da página — evita assinar links que talvez nunca sejam
// abertos. RLS de `materiais` já restringe a busca a alunos matriculados no
// curso dono do material; RLS de `storage.objects` protege de novo na hora
// de assinar (defesa em profundidade, mesmo padrão já usado no resto do
// projeto).
export async function getPdfSignedUrl(
  materialId: string,
): Promise<{ url: string } | { error: string }> {
  await requireRole("aluno");

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materiais")
    .select("url")
    .eq("id", materialId)
    .eq("tipo", "pdf")
    .single();

  if (!material) {
    return { error: "Material não encontrado." };
  }

  const { data: signed, error } = await supabase.storage
    .from("materiais")
    .createSignedUrl(material.url, PDF_SIGNED_URL_EXPIRES_IN);

  if (error || !signed) {
    return { error: "Não foi possível carregar este material." };
  }

  return { url: signed.signedUrl };
}

// Toggle simples: se já concluída, desmarcar é só apagar a linha (RLS já
// restringe a linhas de matrículas do próprio aluno, cobre o caso de mais
// de uma matrícula pro mesmo curso automaticamente). Se ainda não
// concluída, precisa resolver a matrícula concreta pra gravar (FK not
// null) — usa a mais recente entre ativa/concluída pro curso.
export async function toggleAulaConcluida(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  currentlyConcluida: boolean,
): Promise<{ error?: string }> {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  if (currentlyConcluida) {
    const { error } = await supabase.from("aulas_concluidas").delete().eq("aula_id", aulaId);
    if (error) {
      return { error: "Não foi possível desmarcar a aula. Tente novamente." };
    }
  } else {
    const matricula = await getMatriculaAtivaComTurma(supabase, user.id, cursoId);
    if (!matricula) {
      return { error: "Matrícula não encontrada." };
    }

    // Expiração é absoluta — checada antes de qualquer outra regra de
    // liberação (calendário/sequência/manual), mesmo raciocínio da RLS de
    // aulas_concluidas (que também tem essa condição separada).
    const expiracao = await getExpiracaoMatricula(supabase, matricula.id);
    if (expiracao?.expirada) {
      return { error: "Sua matrícula expirou. Fale com a administração para renovar o acesso." };
    }

    // Reforça no servidor a mesma regra de liberação (calendário + aula
    // anterior concluída) usada pra exibir/esconder a página da aula —
    // essa action é um endpoint POST direto, alcançável sem passar pela UI
    // (mesmo tipo de brecha já fechada no quiz/prova: nunca confiar que o
    // client só chegou aqui porque a tela permitiu).
    const liberacao = await getLiberacaoAulasCurso(supabase, cursoId, matricula.turmaId);
    if (!liberacao.get(aulaId)?.liberada) {
      return { error: "Esta aula ainda não está liberada." };
    }

    // marcar_aula_concluida (security definer) reimplementa todas essas
    // mesmas checagens e é o único caminho de escrita em aulas_concluidas
    // desde a Fase 8 — precisou virar function pra poder lançar pontos em
    // pontos_eventos com segurança (ver migration).
    const { error } = await supabase.rpc("marcar_aula_concluida", {
      p_matricula_id: matricula.id,
      p_aula_id: aulaId,
    });
    if (error) {
      return { error: "Não foi possível marcar a aula como concluída. Tente novamente." };
    }

    // Se essa foi a última aula do curso e o curso é EAD, o trigger
    // avaliar_certificado (disparado pelo insert acima) já deixou um
    // certificado pendente_emissao pronto — emite na hora, sem o admin
    // precisar fazer nada. Cursos presenciais/híbridos ficam pendentes
    // mesmo, esperando emissão manual na fila do admin.
    await verificarEmissaoAutomaticaEad(matricula.id);
  }

  // Revalida a própria página da aula (o pill da prova, no AulaAcoesBar de
  // qualquer aula do módulo, depende de isModuloCompleto, recalculado a
  // partir do estado de aulas_concluidas) e as telas com barra de progresso
  // do curso.
  revalidatePath(`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}`);
  revalidatePath(`/aluno/cursos/${cursoId}`);
  revalidatePath("/aluno");
  return {};
}
