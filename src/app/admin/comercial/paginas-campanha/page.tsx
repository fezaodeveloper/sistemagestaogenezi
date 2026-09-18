import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getCampanhaPaginas } from "@/app/admin/comercial/paginas-campanha/actions";
import { parsePagina } from "@/lib/paginacao";
import { CampanhaPaginasView } from "@/components/admin/campanha-paginas-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function PaginasCampanhaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireRole("admin");
  const { q, status, page } = await searchParams;

  const paginaAtual = parsePagina(page);
  const resultado = await getCampanhaPaginas(q ?? "", status ?? "", paginaAtual);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Páginas de Campanha</h1>
          <p className="text-muted-foreground text-sm">
            Landing pages públicas com formulário multi-etapas para captar leads.
          </p>
        </div>
        <Button render={<Link href="/admin/comercial/paginas-campanha/nova" />} nativeButton={false}>
          <Plus />
          Nova página
        </Button>
      </div>

      {resultado.itens.length === 0 && !q && !status ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma página de campanha cadastrada ainda.</p>
            <Button render={<Link href="/admin/comercial/paginas-campanha/nova" />} nativeButton={false} variant="outline">
              <Plus />
              Criar a primeira página
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CampanhaPaginasView
          paginas={resultado.itens}
          totalRegistros={resultado.total}
          paginaAtual={paginaAtual}
          totalPaginas={resultado.totalPaginas}
          query={q ?? ""}
          status={status ?? ""}
        />
      )}
    </div>
  );
}
