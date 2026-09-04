import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getResgatesAdmin, RESGATE_STATUS_LABELS, RESGATE_TIPO_LABELS } from "@/lib/creditos/resgates";
import { MarcarEntregueButton } from "@/components/admin/marcar-entregue-button";
import { EntregaPremioAcoes } from "@/components/admin/entrega-premio-acoes";
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

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function ResgatesPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [pendentes, todos] = await Promise.all([
    getResgatesAdmin(supabase, { status: "pendente" }),
    getResgatesAdmin(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Resgates</h1>
        <p className="text-muted-foreground text-sm">
          Fila de prêmios físicos pendentes de entrega e histórico completo de resgates.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Pendentes de entrega</h2>
        {pendentes.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhum prêmio pendente de entrega no momento.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Prêmio</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Data do resgate</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.alunoNome ?? "—"}</TableCell>
                    <TableCell>{r.itemNome}</TableCell>
                    <TableCell>{r.custoCreditos}</TableCell>
                    <TableCell>{formatDateBR(r.criadoEm)}</TableCell>
                    <TableCell>
                      <EntregaPremioAcoes
                        entregas={r.entregas}
                        nomeAluno={r.alunoNome ?? "—"}
                        nomePremio={r.itemNome}
                      />
                    </TableCell>
                    <TableCell className="flex justify-end">
                      <MarcarEntregueButton id={r.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Histórico completo</h2>
        {todos.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhum resgate registrado ainda.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.alunoNome ?? "—"}</TableCell>
                    <TableCell>{r.itemNome}</TableCell>
                    <TableCell>{RESGATE_TIPO_LABELS[r.tipo]}</TableCell>
                    <TableCell>{r.custoCreditos}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "pendente" ? "outline" : "default"}>
                        {RESGATE_STATUS_LABELS[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <EntregaPremioAcoes
                        entregas={r.entregas}
                        nomeAluno={r.alunoNome ?? "—"}
                        nomePremio={r.itemNome}
                      />
                    </TableCell>
                    <TableCell>{formatDateBR(r.criadoEm)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
