"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mesmo padrão de ChaveGeradaCard (src/components/admin/api-keys-view.tsx)
// — clipboard pode não estar disponível (contexto não-seguro, permissão
// negada); o código Pix continua visível na tela pra copiar à mão.
export function PixCopiaCola({ payload }: { payload: string }) {
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard indisponível — ver comentário acima.
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="bg-muted overflow-x-auto rounded-md border p-3 text-left text-xs break-all">
        {payload}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleCopiar} className="w-full">
        {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copiado ? "Copiado!" : "Copiar código Pix"}
      </Button>
    </div>
  );
}
