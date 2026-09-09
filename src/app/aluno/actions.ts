"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dispararEvento } from "@/lib/automacoes/motor";
import type { LoginBanner } from "@/lib/login-banners/schema";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export type InteresseCursoResult = { success: true } | { error: string };

// Idempotência por semana (chave inclui aluno + curso + número da semana
// corrente) — evita notificar o Telegram mais de 1x por aluno por curso na
// mesma semana, mesmo que o aluno abra o modal e clique "Tenho interesse!"
// várias vezes.
export async function demonstrarInteresse(cursoId: string, alunoId: string): Promise<InteresseCursoResult> {
  const user = await requireRole("aluno");
  if (user.id !== alunoId) {
    return { error: "Não autorizado." };
  }

  const supabase = await createClient();
  const [{ data: aluno }, { data: curso }] = await Promise.all([
    supabase.from("alunos").select("telefone").eq("id", alunoId).maybeSingle(),
    supabase.from("cursos").select("nome").eq("id", cursoId).maybeSingle(),
  ]);

  const semanaAtual = Math.floor(Date.now() / SEMANA_MS);

  await dispararEvento(
    "interesse.curso",
    {
      nome_aluno: user.full_name ?? user.email ?? "—",
      telefone: aluno?.telefone ?? "—",
      nome_curso: curso?.nome ?? "—",
      curso_id: cursoId,
    },
    `interesse-curso-${alunoId}-${cursoId}-${semanaAtual}`,
  );

  return { success: true };
}

// Sem requireRole redundante de propósito diferente do padrão — aqui é o
// próprio (mesma proteção de getBannersLogin, que roda antes de qualquer
// tela existir): a diferença é que esta é chamada de dentro de /aluno, área
// já protegida, mas o Client Component que a chama (BannerSlideshowPortal)
// não recebe o usuário via prop, então a checagem fica aqui mesmo.
export async function getBannersPortal(): Promise<LoginBanner[]> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("login_banners")
    .select("*")
    .eq("ativo", true)
    .eq("tipo", "portal")
    .order("ordem", { ascending: true });

  return (data as LoginBanner[] | null) ?? [];
}
