"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  alunoTemAcessoAoCurso,
  getExpiracaoMatricula,
  getMatriculaAtivaComTurma,
} from "@/lib/matriculas/access";
import { getLiberacaoAulasCurso } from "@/lib/cronograma/liberacao";
import { getConfigComentarios } from "@/lib/comentarios/aula";
import { COMENTARIO_LIMITE_TEXTO } from "@/lib/comentarios/tipos";

const textoSchema = z
  .string()
  .trim()
  .min(1, { error: "Escreva um comentário." })
  .max(COMENTARIO_LIMITE_TEXTO, { error: `O comentário pode ter no máximo ${COMENTARIO_LIMITE_TEXTO} caracteres.` });

// Anti-spam simples: no máximo 5 comentários por minuto por aluno.
const MAX_COMENTARIOS_POR_MINUTO = 5;

function revalidarAula(cursoId: string, moduloId: string, aulaId: string) {
  revalidatePath(`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}`);
}

// A aula precisa pertencer ao módulo e ao curso informados (a action é um endpoint POST
// alcançável direto — não confia nos ids que o client mandou).
async function aulaPertenceAoCurso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoId: string,
  moduloId: string,
  aulaId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("aulas")
    .select("id, modulos(curso_id)")
    .eq("id", aulaId)
    .eq("modulo_id", moduloId)
    .maybeSingle();
  const modulos = (data as unknown as { modulos: { curso_id: string } | null } | null)?.modulos;
  return !!data && modulos?.curso_id === cursoId;
}

export async function criarComentario(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  textoBruto: string,
): Promise<{ error: string } | { success: true; aprovado: boolean }> {
  const user = await requireRole("aluno");

  const parsed = textoSchema.safeParse(textoBruto);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Comentário inválido." };

  const supabase = await createClient();

  if (!(await alunoTemAcessoAoCurso(supabase, user.id, cursoId))) {
    return { error: "Você não tem acesso a esta aula." };
  }
  if (!(await aulaPertenceAoCurso(supabase, cursoId, moduloId, aulaId))) {
    return { error: "Aula não encontrada." };
  }

  const config = await getConfigComentarios(supabase);
  if (!config.ativo) return { error: "Os comentários estão desativados." };

  // Mesmas regras de acesso da página da aula: matrícula não expirada e aula liberada.
  const matricula = await getMatriculaAtivaComTurma(supabase, user.id, cursoId);
  if (matricula) {
    const expiracao = await getExpiracaoMatricula(supabase, matricula.id);
    if (expiracao?.expirada) return { error: "Sua matrícula expirou. Fale com a administração." };
    const liberacao = await getLiberacaoAulasCurso(supabase, cursoId, matricula.turmaId);
    if (liberacao.get(aulaId)?.liberada === false) return { error: "Esta aula ainda não está liberada." };
  }

  const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("aula_comentarios")
    .select("id", { count: "exact", head: true })
    .eq("aluno_id", user.id)
    .gte("created_at", umMinutoAtras);
  if ((count ?? 0) >= MAX_COMENTARIOS_POR_MINUTO) {
    return { error: "Você está comentando rápido demais. Aguarde um instante e tente de novo." };
  }

  // O status (pendente/aprovado) é definido pelo trigger do banco conforme a moderação.
  const { data, error } = await supabase
    .from("aula_comentarios")
    .insert({ aula_id: aulaId, aluno_id: user.id, texto: parsed.data })
    .select("status")
    .single();

  if (error || !data) return { error: "Não foi possível publicar o comentário. Tente novamente." };

  revalidarAula(cursoId, moduloId, aulaId);
  return { success: true, aprovado: data.status === "aprovado" };
}

// Só o próprio comentário e só depois de aprovado (a RLS de delete impõe as duas coisas; o
// filtro abaixo deixa a resposta clara quando nada foi apagado).
export async function excluirComentario(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  comentarioId: string,
): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("aluno");

  if (!z.uuid().safeParse(comentarioId).success) return { error: "Comentário inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aula_comentarios")
    .delete()
    .eq("id", comentarioId)
    .eq("aluno_id", user.id)
    .eq("status", "aprovado")
    .select("id");

  if (error) return { error: "Não foi possível excluir o comentário. Tente novamente." };
  if (!data?.length) return { error: "Comentário não encontrado." };

  revalidarAula(cursoId, moduloId, aulaId);
  return { success: true };
}
