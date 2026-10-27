import type { DadosPortalMatricula } from "@/app/responsavel/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDataBR } from "@/lib/responsavel/formatacao";

export function SecaoDocumentos({ matricula }: { matricula: DadosPortalMatricula }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Contrato de matrícula</span>
          {matricula.statusContrato === "aceito" ? (
            <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
              Assinado em {formatDataBR(matricula.contratoAssinadoEm)}
            </Badge>
          ) : (
            <Button render={<a href={`/contrato/${matricula.id}/assinar`} />} nativeButton={false} variant="outline" size="sm">
              Assinar Contrato →
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Termo de uso de imagem</span>
          {matricula.termoImagemAssinado ? (
            <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
              Assinado em {formatDataBR(matricula.termoImagemAssinadoEm)}
            </Badge>
          ) : (
            <Button
              render={<a href={`/termo-imagem/${matricula.id}/assinar`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Assinar Termo →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
