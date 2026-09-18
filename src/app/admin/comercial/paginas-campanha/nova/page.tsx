import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CampanhaEditor } from "@/components/admin/campanha-editor";

export default async function NovaCampanhaPaginaPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: cursos } = await supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome");

  return <CampanhaEditor cursos={cursos ?? []} />;
}
