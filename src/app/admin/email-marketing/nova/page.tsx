import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmailCampanhaEditor, type CursoOpcao } from "@/components/admin/email-campanha-editor";

// "Enviar agora" roda em segundo plano depois da resposta e usa até ~50s dessa função.
export const maxDuration = 60;

export default async function NovaCampanhaEmailPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("cursos").select("id, nome").order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/email-marketing" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          E-mail Marketing
        </Link>
        <h1 className="text-2xl font-semibold">Nova campanha</h1>
      </div>
      <EmailCampanhaEditor campanha={null} cursos={(data ?? []) as CursoOpcao[]} />
    </div>
  );
}
