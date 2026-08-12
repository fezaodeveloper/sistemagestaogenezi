import { FileBadge } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMeusCertificados } from "@/lib/certificados/certificados";
import { EmitirCertificadoProprioButton } from "@/components/aluno/emitir-certificado-proprio-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function MeusCertificadosPage() {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  const certificados = await getMeusCertificados(supabase, user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus Certificados</h1>
        <p className="text-muted-foreground text-sm">
          Certificados dos cursos que você concluiu.
        </p>
      </div>

      {certificados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <FileBadge className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">
              Você ainda não tem certificados. Conclua um curso (aulas, provas e, se for
              presencial ou híbrido, a frequência mínima) para receber o seu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nomeCurso}</TableCell>
                  <TableCell>
                    {!c.liberado ? (
                      <Badge variant="outline">Aguardando liberação</Badge>
                    ) : c.status === "emitido" ? (
                      <span className="text-muted-foreground text-sm">
                        Emitido em {c.emitidoEm ? formatDateBR(c.emitidoEm) : "—"}
                      </span>
                    ) : (
                      <Badge variant="secondary">Liberado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="flex justify-end">
                    {!c.liberado ? null : c.status === "emitido" ? (
                      <Button
                        render={<a href={`/aluno/certificados/${c.id}/download`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        Baixar
                      </Button>
                    ) : (
                      <EmitirCertificadoProprioButton id={c.id} />
                    )}
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
