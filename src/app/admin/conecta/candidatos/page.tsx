import { requireRole } from "@/lib/auth/dal";
import { Card, CardContent } from "@/components/ui/card";

// Etapa 2 do Gênezi Conecta não detalha a tela de candidatos do admin — a
// busca/gestão de perfis_conecta fica pra uma próxima etapa. Página existe
// só pra o item do menu não cair em 404.
export default async function AdminConectaCandidatosPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidatos — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">Perfis de candidatos disponíveis para as empresas.</p>
      </div>
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Esta funcionalidade estará disponível em breve.
        </CardContent>
      </Card>
    </div>
  );
}
