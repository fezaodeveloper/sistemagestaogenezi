import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Só aceita destino interno ("/algo"): "next" vem da URL, e origin + "@evil.com"
  // (ou "//") viraria um redirect pra fora do site.
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  // Recovery de senha (candidato externo Gênezi Conecta ou aluno) — link
  // gerado por admin.auth.admin.generateLink({ type: "recovery", ... }) no
  // webhook asaas-conecta, vem com token_hash + type na URL em vez de code
  // (fluxo PKCE, usado só pelo login com Google abaixo).
  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });

    if (!error) {
      return NextResponse.redirect(`${origin}/conecta/criar-senha`);
    }
    return NextResponse.redirect(`${origin}/entrar?error=link_invalido`);
  }

  // Confirmação de troca de e-mail (admin em /admin/configuracoes?tab=conta),
  // quando o template do e-mail do Supabase usa token_hash + type em vez do
  // fluxo PKCE com code (tratado mais abaixo).
  if (tokenHash && type === "email_change") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email_change" });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  // Login por link de acesso (portal do aluno em modo "somente e-mail": signInWithOtp).
  // Com o template de e-mail do Supabase usando {{ .TokenHash }}, o link abre em QUALQUER
  // navegador/aparelho (o fluxo com "code" abaixo só funciona no navegador que pediu).
  if (tokenHash && (type === "magiclink" || type === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/entrar?error=link_invalido`);
  }

  // Login social (Google) e confirmação de e-mail via PKCE — fluxo existente.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // O code de uma confirmação de e-mail feita em OUTRO navegador não troca por
    // sessão (o verificador PKCE fica no navegador que pediu a troca) — não é
    // erro do Google.
    if (next.startsWith("/admin")) {
      return NextResponse.redirect(`${origin}/login?error=link_invalido`);
    }
    // Link de acesso do portal do aluno aberto em outro navegador/aparelho.
    if (next.startsWith("/aluno")) {
      return NextResponse.redirect(`${origin}/entrar?error=link_invalido`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=google`);
}
