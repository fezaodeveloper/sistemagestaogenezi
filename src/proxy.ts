import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { loginHome, roleHome, type Role } from "@/lib/auth/roles";

// Camada de conveniência/UX: faz o refresh de sessão (getClaims) e redireciona
// otimisticamente por role. Não é a fronteira de segurança — isso é papel da
// RLS — cada layout/page em /admin e /aluno repete a checagem via
// requireRole() (ver src/lib/auth/dal.ts e a nota em CLAUDE.md).
export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createProxyClient(request);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  const { pathname } = request.nextUrl;

  const areaRole: Role | null = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/aluno")
      ? "aluno"
      : null;

  if (!userId) {
    if (areaRole) {
      return NextResponse.redirect(new URL(loginHome(areaRole), request.url));
    }
    return getResponse();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const role = profile?.role as Role | undefined;

  if (
    role &&
    ((areaRole && areaRole !== role) || pathname === "/login" || pathname === "/entrar" || pathname === "/")
  ) {
    return NextResponse.redirect(new URL(roleHome(role), request.url));
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
