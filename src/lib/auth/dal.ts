import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginHome, roleHome, type Role } from "@/lib/auth/roles";

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  avatar_url: string | null;
  avatar_id: string;
};

export type CurrentUser = Profile & { email: string | null };

// cache() dedupe por request: várias chamadas (layout + page, por exemplo)
// resultam em uma única query.
export const getCurrentProfile = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, avatar_url, avatar_id")
    .eq("id", claims.sub)
    .single();

  if (!profile) {
    return null;
  }

  return { ...profile, email: claims.email ?? null };
});

// Ver nota em CLAUDE.md sobre Layouts e Partial Rendering: cada página nova
// dentro de /admin ou /aluno deve chamar requireRole() diretamente também,
// não confiar só no layout pai.
export async function requireRole(role: Role): Promise<CurrentUser> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(loginHome(role));
  }

  if (profile.role !== role) {
    redirect(roleHome(profile.role));
  }

  return profile;
}
