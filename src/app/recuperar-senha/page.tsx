import Link from "next/link";
import { RecuperarSenhaForm } from "@/components/auth/recuperar-senha-form";
import { Card, CardContent } from "@/components/ui/card";

// Pública de propósito (REGRA da tarefa) — roda antes de qualquer autenticação existir, ver
// ROTAS_PUBLICAS em src/proxy.ts. Sem requireRole: tanto admin quanto aluno esqueceram a senha
// chegam aqui pela mesma tela.
export default async function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  // "from" vem do link "Esqueci minha senha" de cada tela de login (ver login-form.tsx e
  // aluno-login-form.tsx) — só pra voltar pro login certo; não afeta o envio do e-mail.
  const voltarHref = from === "admin" ? "/login" : "/entrar";

  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6 py-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold">Recuperar senha</h1>
            <p className="text-muted-foreground text-sm">
              Informe seu e-mail cadastrado e enviaremos um link para você criar uma nova senha.
            </p>
          </div>
          <RecuperarSenhaForm />
          <Link href={voltarHref} className="text-muted-foreground hover:text-foreground text-center text-sm underline">
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
