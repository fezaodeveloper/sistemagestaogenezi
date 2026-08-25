import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EventoForm } from "@/components/admin/evento-form";
import { createEvento } from "@/app/admin/calendario/actions";

export default async function NovoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  await requireRole("admin");
  const { data: dataPreenchida } = await searchParams;

  const supabase = await createClient();
  const [{ data: cursos }, { data: turmas }] = await Promise.all([
    supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome"),
    supabase.from("turmas").select("id, nome").eq("status", "ativa").order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo evento</h1>
        <p className="text-muted-foreground text-sm">
          Cadastre um evento no calendário acadêmico.
        </p>
      </div>
      <EventoForm
        action={createEvento}
        defaultValues={dataPreenchida ? { data_inicio: dataPreenchida } : undefined}
        submitLabel="Criar evento"
        cursos={cursos ?? []}
        turmas={turmas ?? []}
      />
    </div>
  );
}
