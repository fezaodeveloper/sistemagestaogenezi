import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { getCertificadosAguardandoLiberacao } from "@/lib/certificados/certificados";
import { TabelaCertificadosLiberacao } from "@/components/admin/tabela-certificados-liberacao";
import { Card, CardContent } from "@/components/ui/card";

export default async function CertificadosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  await requireRole("admin");
  const { page, limit } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const supabase = await createClient();
  const { itens, total: totalRegistros } = await getCertificadosAguardandoLiberacao(supabase, {
    offset,
    limite,
  });
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Certificados</h1>
        <p className="text-muted-foreground text-sm">
          Libere os certificados dos alunos que concluíram os critérios.
        </p>
        <p className="text-muted-foreground text-sm">
          {totalRegistros > 0
            ? `${totalRegistros} certificado${totalRegistros > 1 ? "s" : ""} aguardando liberação.`
            : "Nenhum certificado pendente no momento."}
        </p>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhum certificado aguardando liberação no momento.
          </CardContent>
        </Card>
      ) : (
        <TabelaCertificadosLiberacao
          itens={itens}
          paginaAtual={paginaAtual}
          totalPaginas={totalPaginas}
          totalRegistros={totalRegistros}
          limite={limite}
        />
      )}
    </div>
  );
}
