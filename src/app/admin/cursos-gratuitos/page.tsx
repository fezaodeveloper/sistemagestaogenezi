import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CursosGratuitosTable } from "@/components/admin/cursos-gratuitos-table";

export default async function CursosGratuitosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: cursos, error } = await supabase
    .from("cursos")
    .select("id, nome, descricao, url_plataforma_externa, status")
    .eq("gratuito", true)
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cursos Gratuitos</h1>
          <p className="text-muted-foreground text-sm">
            Cursos oferecidos gratuitamente em plataformas externas.
          </p>
        </div>
        <Button render={<Link href="/admin/cursos-gratuitos/novo" />} nativeButton={false}>
          <Plus />
          Novo Curso Gratuito
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os cursos gratuitos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !cursos || cursos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum curso gratuito cadastrado ainda.</p>
            <Button render={<Link href="/admin/cursos-gratuitos/novo" />} nativeButton={false} variant="outline">
              <Plus />
              Cadastrar primeiro curso gratuito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <CursosGratuitosTable cursos={cursos} />
        </Card>
      )}
    </div>
  );
}
