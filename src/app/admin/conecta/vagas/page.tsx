import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { VAGA_MODALIDADE_LABELS, VAGA_TIPO_LABELS } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type VagaComEmpresa = {
  id: string;
  titulo: string;
  cidade: string;
  estado: string;
  modalidade: "presencial" | "hibrido" | "remoto";
  tipo: "emprego" | "estagio";
  status: "ativa" | "pausada" | "encerrada";
  created_at: string;
  empresas_conecta: { nome_empresa: string } | null;
};

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function AdminConectaVagasPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("vagas_conecta")
    .select("id, titulo, cidade, estado, modalidade, tipo, status, created_at, empresas_conecta(nome_empresa)")
    .order("created_at", { ascending: false });

  const vagas = (data as unknown as VagaComEmpresa[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Vagas — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">Todas as vagas publicadas pelas empresas parceiras.</p>
      </div>

      {vagas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma vaga publicada ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Publicada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vagas.map((vaga) => (
                <TableRow key={vaga.id}>
                  <TableCell className="font-medium">{vaga.titulo}</TableCell>
                  <TableCell>{vaga.empresas_conecta?.nome_empresa ?? "—"}</TableCell>
                  <TableCell>
                    {vaga.cidade}/{vaga.estado}
                  </TableCell>
                  <TableCell>{VAGA_TIPO_LABELS[vaga.tipo]}</TableCell>
                  <TableCell>{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{vaga.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDateBR(vaga.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
