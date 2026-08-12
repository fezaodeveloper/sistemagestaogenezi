import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCertificadosAguardandoLiberacao } from "@/lib/certificados/certificados";
import { TabelaCertificadosLiberacao } from "@/components/admin/tabela-certificados-liberacao";
import { Card, CardContent } from "@/components/ui/card";

export default async function CertificadosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const itens = await getCertificadosAguardandoLiberacao(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Certificados</h1>
        <p className="text-muted-foreground text-sm">
          Certificados aguardando liberação. Cursos EAD liberam e emitem automaticamente assim
          que o aluno atinge os critérios — só aparecem aqui cursos presenciais/híbridos (ou, no
          raro caso de uma emissão automática ter falhado, um EAD pra liberar manualmente). Depois
          de liberado, o próprio aluno emite o certificado quando quiser.
        </p>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhum certificado aguardando liberação no momento.
          </CardContent>
        </Card>
      ) : (
        <TabelaCertificadosLiberacao itens={itens} />
      )}
    </div>
  );
}
