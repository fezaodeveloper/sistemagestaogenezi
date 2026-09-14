import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

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

  // Login social (Google) — fluxo existente.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=google`);
}
