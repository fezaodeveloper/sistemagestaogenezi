import type { Metadata } from "next";
import { descadastrarEmail, lerTokenDescadastro } from "@/lib/email/descadastro";
import { createAdminClient } from "@/lib/supabase/admin";
import { informarMotivo, reinscrever } from "@/app/descadastro/[token]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Página pública (sem login). Dinâmica: cada acesso descadastra.
export const dynamic = "force-dynamic";

// Link de e-mail não deve ser indexado nem repassado a terceiros.
export const metadata: Metadata = { title: "Descadastro de e-mails", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function nomeDaEscola(): Promise<string> {
  try {
    const { data } = await createAdminClient().from("configuracoes").select("escola_nome").eq("id", true).maybeSingle();
    if (data?.escola_nome) return data.escola_nome as string;
  } catch {
    // usa o padrão
  }
  return "GÊNEZI Educação";
}

export default async function DescadastroPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { token } = await params;
  const { estado } = await searchParams;
  const [email, nomeEscola] = await Promise.all([Promise.resolve(lerTokenDescadastro(token)), nomeDaEscola()]);

  let conteudo: React.ReactNode;

  if (!email) {
    conteudo = (
      <>
        <h1 className="text-xl font-semibold">Link inválido</h1>
        <p className="text-muted-foreground text-sm">
          Este link de descadastro não é válido. Use o link que veio no e-mail que você recebeu, ou responda a ele pedindo para
          não receber mais mensagens.
        </p>
      </>
    );
  } else if (estado === "reinscrito") {
    // Desfeito pelo próprio destinatário (não descadastra de novo ao abrir).
    conteudo = (
      <>
        <h1 className="text-xl font-semibold">Tudo certo!</h1>
        <p className="text-muted-foreground text-sm">Você voltou a receber os e-mails de marketing da {nomeEscola}.</p>
      </>
    );
  } else {
    // Abrir o link descadastra (idempotente: abrir de novo não muda nada).
    const resultado = estado === "motivo" ? { ok: true } : await descadastrarEmail(email);

    conteudo = !resultado.ok ? (
      <>
        <h1 className="text-xl font-semibold">Não foi possível concluir</h1>
        <p className="text-muted-foreground text-sm">Ocorreu um erro ao registrar o seu pedido. Tente abrir o link novamente em instantes.</p>
      </>
    ) : (
      <>
        <h1 className="text-xl font-semibold">Descadastro concluído</h1>
        <p className="text-sm">Você foi descadastrado com sucesso dos e-mails de marketing da {nomeEscola}.</p>
        <p className="text-muted-foreground text-xs">
          Você continuará recebendo e-mails importantes sobre o seu curso, como matrícula, cobranças e acesso ao portal.
        </p>

        {estado === "motivo" ? (
          <p className="text-sm text-green-600 dark:text-green-400">Obrigado pelo retorno!</p>
        ) : (
          <form action={informarMotivo.bind(null, token)} className="flex flex-col gap-2 border-t pt-4">
            <label htmlFor="motivo" className="text-sm font-medium">
              Quer nos contar o motivo? (opcional)
            </label>
            <Textarea id="motivo" name="motivo" rows={3} maxLength={500} />
            <Button type="submit" variant="outline" size="sm" className="w-fit">
              Enviar
            </Button>
          </form>
        )}

        <form action={reinscrever.bind(null, token)} className="border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs">Foi engano?</p>
          <Button type="submit" variant="ghost" size="sm">
            Voltar a receber os e-mails
          </Button>
        </form>
      </>
    );
  }

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-4 py-6">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{nomeEscola}</p>
          {conteudo}
        </CardContent>
      </Card>
    </main>
  );
}
