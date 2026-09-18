import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCampanhaPagina } from "@/lib/campanha-paginas/campanha-paginas";
import { CampanhaEditor } from "@/components/admin/campanha-editor";

export default async function EditarCampanhaPaginaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [pagina, { data: cursos }] = await Promise.all([
    getCampanhaPagina(supabase, id),
    supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  if (!pagina) notFound();

  return <CampanhaEditor pagina={pagina} cursos={cursos ?? []} />;
}
