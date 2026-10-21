import { createAdminClient } from "@/lib/supabase/admin";
import { PortalResponsavelAuth } from "@/components/responsavel/portal-responsavel-auth";
import { Card, CardContent } from "@/components/ui/card";

// Server Component público — sem requireRole, sem sidebar/menu admin. Mesma estrutura das
// páginas de entrada dos itens 6/7 (/contrato/[matriculaId]/assinar,
// /termo-imagem/[matriculaId]/assinar): alunoId na URL como bearer token implícito.
export default async function PortalResponsavelPage({
  params,
}: {
  params: Promise<{ alunoId: string }>;
}) {
  const { alunoId } = await params;
  const admin = createAdminClient();

  const { data: aluno } = await admin.from("alunos").select("id, full_name").eq("id", alunoId).maybeSingle();

  if (!aluno) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-sm">Link inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { count } = await admin.from("responsaveis").select("id", { count: "exact", head: true }).eq("aluno_id", alunoId);

  if (!count) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-sm">Este aluno não tem responsável cadastrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <PortalResponsavelAuth alunoId={alunoId} nomeAluno={aluno.full_name ?? "Aluno"} />
    </div>
  );
}
