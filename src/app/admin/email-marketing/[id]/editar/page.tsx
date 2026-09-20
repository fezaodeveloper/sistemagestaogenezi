import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isSegmentoEmail } from "@/lib/email/marketing-tipos";
import { EmailCampanhaEditor, type CampanhaEditavel, type CursoOpcao } from "@/components/admin/email-campanha-editor";

// "Enviar agora" roda em segundo plano depois da resposta e usa até ~50s dessa função.
export const maxDuration = 60;

export default async function EditarCampanhaEmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: campanha }, { data: cursos }] = await Promise.all([
    supabase
      .from("email_campanhas_marketing")
      .select("id, nome, assunto, corpo_html, segmento, curso_id, status, agendada_para")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("cursos").select("id, nome").order("nome"),
  ]);
  if (!campanha) notFound();

  // Já enviada/em envio/cancelada: não se edita, só se acompanha.
  if (campanha.status !== "rascunho" && campanha.status !== "agendada") redirect(`/admin/email-marketing/${id}`);

  const editavel: CampanhaEditavel = {
    id: campanha.id as string,
    nome: campanha.nome as string,
    assunto: campanha.assunto as string,
    corpo_html: campanha.corpo_html as string,
    segmento: isSegmentoEmail(campanha.segmento) ? campanha.segmento : "todos",
    curso_id: (campanha.curso_id as string | null) ?? null,
    status: campanha.status as "rascunho" | "agendada",
    agendada_para: (campanha.agendada_para as string | null) ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/email-marketing" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          E-mail Marketing
        </Link>
        <h1 className="text-2xl font-semibold">Editar campanha</h1>
      </div>
      <EmailCampanhaEditor campanha={editavel} cursos={(cursos ?? []) as CursoOpcao[]} />
    </div>
  );
}
