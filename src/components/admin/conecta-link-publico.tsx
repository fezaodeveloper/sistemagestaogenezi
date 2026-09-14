"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const URL_PUBLICA_VAGAS = "https://sistemagestaogenezi.vercel.app/conecta/vagas";

// Mesmo padrão de ChaveGeradaCard (src/components/admin/api-keys-view.tsx)
// / PixCopiaCola — clipboard pode não estar disponível, a URL continua
// visível na tela pra copiar à mão.
export function ConectaLinkPublico() {
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(URL_PUBLICA_VAGAS);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard indisponível — ver comentário acima.
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Compartilhe este link para divulgar as vagas:</p>
          <p className="text-muted-foreground font-mono text-xs break-all">{URL_PUBLICA_VAGAS}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopiar}>
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? "Copiado!" : "Copiar link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={URL_PUBLICA_VAGAS} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-4" />
            Abrir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
