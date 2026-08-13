import { createAdminClient } from "@/lib/supabase/admin";
import { FormularioCaptacao } from "@/components/leads/formulario-captacao";

// Página pública (sem login) — o Server Component roda no servidor, então
// usar o client admin aqui pra listar os cursos ativos não expõe nada ao
// visitante além do que ele já veria em qualquer material de divulgação;
// evita ter que abrir RLS/grant de "anon" em cursos só pra isso.
//
// force-dynamic: sem cookies()/headers(), o Next tentaria prerenderizar
// essa página como estática no build, congelando a lista de cursos até o
// próximo deploy — um curso novo cadastrado depois não apareceria no
// formulário público sem isso.
export const dynamic = "force-dynamic";

export default async function CaptacaoPage() {
  const admin = createAdminClient();
  const { data: cursos } = await admin
    .from("cursos")
    .select("id, nome")
    .eq("status", "ativo")
    .order("nome");

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-semibold">Quero saber mais</h1>
          <p className="text-muted-foreground text-sm">
            Deixe seus dados que entramos em contato pelo WhatsApp.
          </p>
        </div>
        <FormularioCaptacao cursos={cursos ?? []} />
      </div>
    </main>
  );
}
