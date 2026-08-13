import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { LeadForm } from "@/components/admin/lead-form";
import { createLead } from "@/app/admin/leads/actions";

export default async function NovoLeadPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: cursos } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("status", "ativo")
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo lead</h1>
        <p className="text-muted-foreground text-sm">
          Cadastro manual — use para quem ligou, apareceu pessoalmente etc.
        </p>
      </div>
      <LeadForm action={createLead} submitLabel="Cadastrar" cursos={cursos ?? []} />
    </div>
  );
}
