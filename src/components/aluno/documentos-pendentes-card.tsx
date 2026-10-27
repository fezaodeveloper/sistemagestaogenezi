import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Só renderiza quando há pelo menos um pendente — nenhum dos dois pendente (ou aluno sem
// matrícula ativa/sem contrato gerado) e o componente não aparece, sem precisar de um estado
// "✅ documentos ok" ocupando espaço permanentemente no topo do dashboard.
export function DocumentosPendentesCard({
  matriculaIdContratoPendente,
  matriculaIdTermoImagemPendente,
}: {
  matriculaIdContratoPendente: string | null;
  matriculaIdTermoImagemPendente: string | null;
}) {
  if (!matriculaIdContratoPendente && !matriculaIdTermoImagemPendente) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/10">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2 text-amber-200">
          <FileWarning className="size-4" />
          <span className="font-medium">Documentos pendentes</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {matriculaIdContratoPendente && (
            <Button render={<Link href="/aluno/contrato" />} nativeButton={false} size="sm" variant="outline">
              Assinar Contrato →
            </Button>
          )}
          {matriculaIdTermoImagemPendente && (
            <Button
              render={
                <a
                  href={`/termo-imagem/${matriculaIdTermoImagemPendente}/assinar`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
              size="sm"
              variant="outline"
            >
              Assinar Termo de Imagem →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
