import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { LoginForm } from "@/components/auth/login-form";
import { BannerSlideshow } from "@/components/auth/banner-slideshow";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(roleHome(profile.role));
  }

  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh">
      {/* Coluna esquerda — slideshow, escondida em telas menores que lg
          (ver TAREFA 6: mobile mostra só o formulário). */}
      <div className="hidden lg:flex lg:w-[75%] relative overflow-hidden">
        <BannerSlideshow tipo="aluno" />
      </div>

      {/* Coluna direita — formulário */}
      <div className="flex flex-col items-center justify-center w-full lg:w-[25%] p-6 bg-background">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
            <span className="text-4xl">🎓</span>
          </div>
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

        <p className="mt-8 text-xs text-muted-foreground">© 2026 GÊNEZI Educação Profissional</p>
      </div>
    </main>
  );
}
