"use client";

import { useState, useTransition } from "react";
import { gerarRelatorioFrequenciaTurma } from "@/app/admin/turmas/[id]/presencas/actions";
import { Button } from "@/components/ui/button";

// Mesmo padrão de download-com-nome-de-arquivo de backup-section.tsx
// (Blob + <a download> + revokeObjectURL) — o base64 vem da Server Action
// (gerarRelatorioFrequenciaTurma), que já gerou o PDF/Excel no servidor.
function baixarArquivoBase64(base64: string, filename: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportarFrequenciaButtons({ turmaId }: { turmaId: string }) {
  const [isPendingPdf, startTransitionPdf] = useTransition();
  const [isPendingExcel, startTransitionExcel] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExportar(formato: "pdf" | "excel") {
    setError(null);
    const startTransition = formato === "pdf" ? startTransitionPdf : startTransitionExcel;
    startTransition(async () => {
      const resultado = await gerarRelatorioFrequenciaTurma(turmaId, formato);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      const mimeType =
        formato === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      baixarArquivoBase64(resultado.data, resultado.filename, mimeType);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPendingPdf}
          onClick={() => handleExportar("pdf")}
        >
          📄 {isPendingPdf ? "Gerando..." : "PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPendingExcel}
          onClick={() => handleExportar("excel")}
        >
          📊 {isPendingExcel ? "Gerando..." : "Excel"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
