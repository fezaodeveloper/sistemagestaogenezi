import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaPorProfileId, getVagasDaEmpresa } from "@/lib/conecta/empresas";
import { VAGA_MODALIDADE_LABELS, VAGA_TIPO_LABELS } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Etapa 1 (base de dados + autenticação) — a publicação de vagas em si
// (formulário de criação) fica pra uma próxima etapa; esta tela já lista as
// vagas existentes (nenhuma ainda, pra uma empresa recém-cadastrada).
export default async function EmpresaVagasPage() {
  const user = await requireEmpresa();
  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  const vagas = empresa ? await getVagasDaEmpresa(supabase, empresa.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Minhas vagas</h1>
          <p className="text-muted-foreground text-sm">Vagas publicadas pela sua empresa.</p>
        </div>
        <Button type="button" disabled title="Publicação de vagas estará disponível em breve.">
          Publicar nova vaga
        </Button>
      </div>

      {vagas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma vaga publicada ainda.</p>
            <p className="text-muted-foreground text-xs">
              A publicação de vagas estará disponível em breve.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vagas.map((vaga) => (
            <Card key={vaga.id}>
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{vaga.titulo}</span>
                  <Badge variant="outline">{vaga.status}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {vaga.cidade}/{vaga.estado} · {VAGA_MODALIDADE_LABELS[vaga.modalidade]} ·{" "}
                  {VAGA_TIPO_LABELS[vaga.tipo]}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
