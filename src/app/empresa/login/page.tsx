import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { EmpresaLoginForm } from "@/components/empresa/empresa-login-form";

export default async function EmpresaLoginPage() {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(roleHome(profile.role));
  }

  const supabase = await createClient();
  const { data: configuracoes } = await supabase
    .from("configuracoes")
    .select("escola_logo_url")
    .single();

  return (
    <main className="dark bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3">
        {configuracoes?.escola_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto, sem necessidade de otimização do next/image aqui
          <img
            src={configuracoes.escola_logo_url}
            alt="Logo da escola"
            className="h-32 w-32 rounded-2xl object-contain"
          />
        ) : (
          <div className="border-muted-foreground/30 flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed bg-muted">
            <span className="text-4xl">🏢</span>
          </div>
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold">GÊNEZI Conecta</h1>
          <p className="text-muted-foreground text-sm">Portal da empresa parceira</p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Bem-vindo!</h2>
          <p className="text-muted-foreground text-sm">Acesse o painel da sua empresa.</p>
        </div>
        <EmpresaLoginForm />
      </div>

      <Link href="/entrar" className="text-muted-foreground text-xs underline underline-offset-2">
        Sou aluno ou administrador
      </Link>
    </main>
  );
}
