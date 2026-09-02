import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import type { TurmaWithCurso } from "@/lib/turmas/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TurmasTable } from "@/components/admin/turmas-table";

export default async function TurmasPage({
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
  const { data, error, count } = await supabase
    .from("turmas")
    .select("*, cursos(nome)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);
  const turmas = data as TurmaWithCurso[] | null;
  const totalRegistros = count ?? 0;
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Turmas</h1>
        <p className="text-muted-foreground text-sm">Turmas vinculadas aos cursos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as turmas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !turmas || totalRegistros === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma turma cadastrada ainda.</p>
            <Button
              render={<Link href="/admin/turmas/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeira turma
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <TurmasTable
            turmas={turmas}
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            limite={limite}
          />
        </Card>
      )}
    </div>
  );
}
