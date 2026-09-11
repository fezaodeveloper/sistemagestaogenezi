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

  // Só busca o profile se houver sessão — visitante anônimo em rota pública
  // não precisa de round-trip nenhum ao banco.
  let role: Role | undefined;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    role = profile?.role as Role | undefined;
  }

  // Rotas públicas nunca exigem autenticação — ficam completamente fora da
  // lógica de área protegida abaixo, o que evita por construção qualquer
  // redirect-por-falta-de-auth nelas (era essa mistura que causava o loop em
  // /empresa/login: a rota era "pública" pro fluxo de login, mas também
  // batia no matcher de área protegida "/empresa"). startsWith(rota + "/")
  // cobre eventuais subrotas futuras sem precisar listar cada uma.
  const ROTAS_PUBLICAS = ["/login", "/entrar", "/empresa/login", "/empresa/cadastro", "/captacao", "/"];
  const isRotaPublica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(rota + "/"),
  );

  if (isRotaPublica) {
    // Usuário já autenticado numa tela de login (ou na home): manda direto
    // pra área dele, em vez de deixar ver a tela de login de novo. Rotas
    // públicas que NÃO são "tela de login" (captacao, empresa/cadastro)
    // ficam de fora dessa lista de propósito — continuam acessíveis mesmo
    // logado.
    if (userId && role) {
      const ROTAS_DE_LOGIN = ["/login", "/entrar", "/empresa/login", "/"];
      if (ROTAS_DE_LOGIN.includes(pathname)) {
        return NextResponse.redirect(new URL(roleHome(role), request.url));
      }
    }
    return getResponse();
  }

  // A partir daqui, pathname não é pública — decide a área protegida.
  const areaRole: Role | null = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/aluno")
      ? "aluno"
      : pathname.startsWith("/empresa")
        ? "empresa"
        : null;

  if (!userId) {
    if (areaRole) {
      return NextResponse.redirect(new URL(loginHome(areaRole), request.url));
    }
    return getResponse();
  }

  if (role && areaRole && areaRole !== role) {
    return NextResponse.redirect(new URL(roleHome(role), request.url));
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
