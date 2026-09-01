"use client";

import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { assinarContrato } from "@/app/aluno/contrato/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ContratoAssinado } from "@/lib/contratos/schema";

// O PDF já vem em base64 (contratos_assinados.conteudo_pdf_base64) — vira
// um Blob local só pra ter uma URL que o <iframe> e o link de download
// conseguem usar, sem precisar de uma rota de download separada.
function base64ParaBlobUrl(base64: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, (caractere) => caractere.charCodeAt(0));
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export function AlunoContratoView({ contrato }: { contrato: ContratoAssinado }) {
  const [concordo, setConcordo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [assinado, setAssinado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pdfUrl = useMemo(
    () => (contrato.conteudo_pdf_base64 ? base64ParaBlobUrl(contrato.conteudo_pdf_base64) : null),
    [contrato.conteudo_pdf_base64],
  );

  function handleAssinar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await assinarContrato(contrato.matricula_id);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      setAssinado(true);
    });
  }

  if (assinado) {
    return (
      <Card className="border-primary">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Check className="text-primary size-8" />
          <p className="font-medium">Contrato assinado com sucesso!</p>
          {pdfUrl && (
            <Button
              render={<a href={pdfUrl} download="contrato.pdf" />}
              nativeButton={false}
              variant="outline"
            >
              Baixar contrato
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pdfUrl ? (
        <iframe src={pdfUrl} title="Contrato de matrícula" className="h-[70vh] w-full rounded-lg border" />
      ) : (
        <p className="text-muted-foreground text-sm">Não foi possível carregar o PDF do contrato.</p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="concordo"
          checked={concordo}
          onCheckedChange={(checked) => setConcordo(checked === true)}
        />
        <Label htmlFor="concordo" className="font-normal">
          Li e concordo com os termos deste contrato
        </Label>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      <Button type="button" onClick={handleAssinar} disabled={!concordo || isPending} className="w-fit">
        {isPending ? "Assinando..." : "Assinar contrato digitalmente"}
      </Button>
    </div>
  );
}
