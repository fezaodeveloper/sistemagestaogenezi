"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import type { LoginBanner, LoginBannerTipo } from "@/lib/login-banners/schema";

export type LoginState = { error?: string } | undefined;

// Sem requireRole de propósito — a tela de login é pública, roda antes de
// qualquer autenticação existir. RLS de login_banners já restringe o
// resultado a "ativo = true" pra quem não é admin (ver migration), mas
// filtramos de novo aqui pra deixar a intenção explícita no código.
export async function getBannersLogin(tipo: LoginBannerTipo = "admin"): Promise<LoginBanner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("login_banners")
    .select("*")
    .eq("ativo", true)
    .eq("tipo", tipo)
    .order("ordem", { ascending: true });

  return (data as LoginBanner[] | null) ?? [];
}

export async function signInWithPassword(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
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

  // Redireciona direto pro destino final (não para "/" que redirecionaria de
  // novo): o mecanismo de "single response" do Next 16 para Server Actions
  // não encadeia corretamente um redirect dentro do redirect de outro.
  const profile = await getCurrentProfile();
  redirect(profile ? roleHome(profile.role) : "/login");
}

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}
