import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getContratoAluno } from "./actions";
import { AlunoContratoView } from "@/components/aluno/aluno-contrato-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

export default async function AlunoContratoPage() {
  await requireRole("aluno");

  const contrato = await getContratoAluno();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu Contrato</h1>
        <p className="text-muted-foreground text-sm">
          Contrato de prestação de serviços educacionais da sua matrícula.
        </p>
      </div>

      {!contrato ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">Nenhum contrato pendente.</p>
          </CardContent>
        </Card>
      ) : contrato.status === "aceito" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
              Contrato assinado em {contrato.aceito_em ? formatDataHora(contrato.aceito_em) : "—"}
            </Badge>
            {contrato.conteudo_pdf_base64 && (
              <Button
                render={
                  <a
                    href={`data:application/pdf;base64,${contrato.conteudo_pdf_base64}`}
                    download="contrato.pdf"
                  />
                }
                nativeButton={false}
                variant="outline"
              >
                Baixar contrato
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <AlunoContratoView contrato={contrato} />
      )}
    </div>
  );
}
