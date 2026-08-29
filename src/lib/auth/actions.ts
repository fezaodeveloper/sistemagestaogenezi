"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/dal";
import { loginHome } from "@/lib/auth/roles";

export async function signOut() {
  // Precisa ler o role ANTES de encerrar a sessão — depois do signOut não
  // dá mais pra saber se quem saiu era admin ou aluno, pra escolher entre
  // /login e /entrar.
  const profile = await getCurrentProfile();

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect(profile ? loginHome(profile.role) : "/login");
}
