import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CursoForm } from "@/components/admin/curso-form";
import { CursoResgateForm } from "@/components/admin/curso-resgate-form";
import { updateCurso, updateCursoResgate } from "@/app/admin/cursos/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Curso } from "@/lib/cursos/schema";

export default async function EditarCursoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("cursos").select("*").eq("id", id).single();
  const curso = data as Curso | null;

  if (!curso) {
    notFound();
  }

  const capaAtualUrl = curso.capa_url
    ? supabase.storage.from("cursos").getPublicUrl(curso.capa_url).data.publicUrl
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar curso</h1>
        <p className="text-muted-foreground text-sm">{curso.nome}</p>
      </div>
      <CursoForm
        action={updateCurso.bind(null, curso.id, curso.capa_url)}
        defaultValues={{
          nome: curso.nome,
          descricao: curso.descricao ?? undefined,
          tipo: curso.tipo,
          status: curso.status,
          carga_horaria_horas: curso.carga_horaria_horas ?? undefined,
          valor: curso.valor ?? undefined,
        }}
        capaAtualUrl={capaAtualUrl}
        submitLabel="Salvar alterações"
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Resgate com créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <CursoResgateForm
            action={updateCursoResgate.bind(null, curso.id)}
            disponivelInicial={curso.disponivel_para_resgate}
            custoInicial={curso.custo_creditos}
          />
        </CardContent>
      </Card>
    </div>
  );
}
