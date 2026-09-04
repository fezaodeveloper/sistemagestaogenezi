import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Premio } from "@/lib/premios/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeletePremioButton } from "@/components/admin/delete-premio-button";

// "21/08/2026 às 14:32" — mesmo formato usado em outras telas do admin
// (ver matriculas-table.tsx).
function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

export default async function PremiosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("premios")
    .select("*")
    .order("created_at", { ascending: false });
  const premios = data as Premio[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prêmios</h1>
          <p className="text-muted-foreground text-sm">Catálogo de prêmios físicos resgatáveis.</p>
        </div>
        <Button render={<Link href="/admin/premios/novo" />} nativeButton={false}>
          <Plus />
          Novo prêmio
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os prêmios. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !premios || premios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum prêmio cadastrado ainda.</p>
            <Button
              render={<Link href="/admin/premios/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro prêmio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {premios.map((premio) => (
                <TableRow key={premio.id}>
                  <TableCell className="font-medium">{premio.nome}</TableCell>
                  <TableCell>{premio.custo_creditos}</TableCell>
                  <TableCell>{premio.estoque === null ? "Ilimitado" : premio.estoque}</TableCell>
                  <TableCell>
                    <Badge variant={premio.ativo ? "default" : "outline"}>
                      {premio.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDataHora(premio.created_at)}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={<Link href={`/admin/premios/${premio.id}/editar`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeletePremioButton
                      id={premio.id}
                      nome={premio.nome}
                      fotoUrl={premio.foto_url}
                      arquivoDigitalPath={premio.entrega_arquivo_path}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
