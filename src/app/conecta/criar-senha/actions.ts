"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const SENHA_MIN_LENGTH = 8;

// Sem requireRole (aceita 'aluno' ou 'externo' via mesma role 'aluno',
// REGRA da tarefa) — só exige QUALQUER sessão válida, que é a estabelecida
// por verifyOtp no callback de recovery (src/app/auth/callback/route.ts).
// updateUser roda no client autenticado normal (não no admin): é a própria
// sessão de recovery quem está trocando a própria senha, não precisa do
// bypass do service_role.
export async function criarSenhaConecta(novaSenha: string): Promise<{ error?: string } | undefined> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/entrar");
  }

  if (novaSenha.length < SENHA_MIN_LENGTH) {
    return { error: `A senha precisa ter pelo menos ${SENHA_MIN_LENGTH} caracteres.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: novaSenha });

  if (error) {
    return { error: "Não foi possível salvar a senha. Tente novamente." };
  }

  redirect("/aluno/conecta");
}
