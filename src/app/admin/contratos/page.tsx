import { FileSignature } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ContratosView, type ContratoListItem } from "@/components/admin/contratos-view";
import { Card, CardContent } from "@/components/ui/card";

export default async function ContratosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos_assinados")
    .select(
      "id, matricula_id, status, aceito_em, created_at, alunos(full_name, email), matriculas(turmas(nome, cursos(nome)))",
    )
    .order("created_at", { ascending: false });
  const contratos = data as ContratoListItem[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Contratos de Matrícula</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe o status de assinatura dos contratos gerados nas matrículas.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os contratos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !contratos || contratos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <FileSignature className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">Nenhum contrato gerado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <ContratosView contratos={contratos} />
        </Card>
      )}
    </div>
  );
}
