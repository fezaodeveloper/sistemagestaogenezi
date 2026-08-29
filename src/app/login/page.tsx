import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { BannerSlideshow } from "@/components/auth/banner-slideshow";

const RODAPE_LOGIN_PADRAO = "© 2026 GÊNEZI Educação Profissional";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(roleHome(profile.role));
  }

  const supabase = await createClient();
  const [{ error }, { data: configuracoes }] = await Promise.all([
    searchParams,
    supabase.from("configuracoes").select("escola_logo_url, login_rodape").single(),
  ]);

  return (
    <main className="flex h-svh">
      {/* Coluna esquerda — slideshow, escondida em telas menores que lg
          (ver TAREFA 6: mobile mostra só o formulário). */}
      <div className="hidden lg:flex lg:w-[75%] relative overflow-hidden">
        <BannerSlideshow tipo="admin" />
      </div>

      {/* Coluna direita — formulário. overflow-y-auto evita que o conteúdo
          seja cortado quando a viewport é baixa demais pra caber tudo com
          h-svh (ver PROBLEMA 2). */}
      <div className="flex flex-col items-center justify-center w-full lg:w-[25%] p-6 bg-background overflow-y-auto">
        <div className="mb-6 flex flex-col items-center gap-3">
          {configuracoes?.escola_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto, sem necessidade de otimização do next/image aqui
            <img
              src={configuracoes.escola_logo_url}
              alt="Logo da escola"
              className="w-32 h-32 rounded-2xl object-contain"
            />
          ) : (
            <div className="w-32 h-32 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
              <span className="text-4xl">🎓</span>
            </div>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">GÊNEZI</h1>
            <p className="text-sm text-muted-foreground">Educação Profissional</p>
          </div>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Bem-vindo!</h2>
            <p className="text-muted-foreground text-sm">Acesse sua conta para continuar.</p>
          </div>
          {error === "google" && (
            <p role="alert" className="text-destructive text-sm">
              Não foi possível entrar com o Google. Tente novamente.
            </p>
          )}
          <LoginForm />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          {configuracoes?.login_rodape ?? RODAPE_LOGIN_PADRAO}
        </p>
      </div>
    </main>
  );
}
