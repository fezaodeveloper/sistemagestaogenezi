import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
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
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <p className="text-muted-foreground text-sm">Acesse sua conta para continuar.</p>
        </div>
        {error === "google" && (
          <p role="alert" className="text-destructive text-center text-sm">
            Não foi possível entrar com o Google. Tente novamente.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
