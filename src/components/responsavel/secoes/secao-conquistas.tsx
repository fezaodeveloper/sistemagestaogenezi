import { Award, Download } from "lucide-react";
import type { DadosPortal, DadosPortalCertificado } from "@/app/responsavel/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SecaoCertificado({ certificado }: { certificado: DadosPortalCertificado | null }) {
  if (!certificado) {
    return (
      <p className="text-muted-foreground text-sm">Certificado ainda não disponível.</p>
    );
  }

  if (certificado.liberado && certificado.arquivoUrl) {
    return (
      <Button render={<a href={certificado.arquivoUrl} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
        <Download className="size-4" />
        Baixar Certificado
      </Button>
    );
  }

  if (!certificado.liberado) {
    return <p className="text-muted-foreground text-sm">Certificado em processo de emissão.</p>;
  }

  return <p className="text-muted-foreground text-sm">Certificado liberado, aguardando arquivo.</p>;
}

export function SecaoConquistas({
  badges,
  certificado,
}: {
  badges: DadosPortal["badges"];
  certificado: DadosPortalCertificado | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificado</CardTitle>
        </CardHeader>
        <CardContent>
          <SecaoCertificado certificado={certificado} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medalhas</CardTitle>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
              <Award className="size-8" />
              Nenhuma conquista ainda.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {badges.map((badge) => (
                <div key={badge.id} className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
                  <span className="text-2xl">{badge.icone}</span>
                  <span className="text-sm font-medium">{badge.nome}</span>
                  <span className="text-muted-foreground text-xs">{badge.descricao}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
