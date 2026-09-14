import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { ConectaCriarSenhaForm } from "@/components/conecta/criar-senha-form";
import { Card, CardContent } from "@/components/ui/card";

// "Pública mas requer sessão ativa de recovery" (REGRA da tarefa): sem
// requireRole/requireEmpresa (aceita qualquer role autenticado — aluno ou
// candidato externo, ambos com role 'aluno'), mas exige QUALQUER sessão
// válida — a estabelecida por verifyOtp no callback de recovery
// (src/app/auth/callback/route.ts). Sem sessão, não tem senha pra trocar.
export default async function ConectaCriarSenhaPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/entrar");
  }

  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6 py-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold">🔐 Criar sua senha de acesso</h1>
            <p className="text-muted-foreground text-sm">
              Defina uma senha para acessar o Gênezi Conecta
            </p>
          </div>
          <ConectaCriarSenhaForm />
        </CardContent>
      </Card>
    </main>
  );
}
