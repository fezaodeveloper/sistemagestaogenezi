"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/dal";

export type LoginEmpresaState = { error?: string } | undefined;

export async function loginEmpresa(
  _prevState: LoginEmpresaState,
  formData: FormData,
): Promise<LoginEmpresaState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "empresa") {
    // Sessão foi criada (credenciais corretas), mas a conta não é de
    // empresa — encerra de novo antes de devolver o erro, pra não deixar
    // uma sessão "órfã" (autenticado numa área errada) na tela de login.
    await supabase.auth.signOut();
    return { error: "Esta conta não está cadastrada como empresa." };
  }

  // Redireciona direto pro destino final — mesmo motivo documentado em
  // signInWithPassword (src/app/login/actions.ts): encadear um redirect
  // dentro de outro não funciona corretamente pra Server Actions no Next 16.
  redirect("/empresa/painel");
}
