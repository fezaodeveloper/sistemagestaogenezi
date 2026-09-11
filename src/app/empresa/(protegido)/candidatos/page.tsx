import { requireEmpresa } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";

// Etapa 1 (base de dados + autenticação) — a busca de candidatos
// (perfis_conecta) fica pra uma próxima etapa.
export default async function EmpresaCandidatosPage() {
  await requireEmpresa();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidatos</h1>
        <p className="text-muted-foreground text-sm">Busque candidatos interessados nas suas vagas.</p>
      </div>
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Esta funcionalidade estará disponível em breve.
        </CardContent>
      </Card>
    </div>
  );
}
