"use client";

// "use client": clipboard e feedback visual temporário ("Copiado!").

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopiarWhatsappButton({
  telefone,
  comTexto = false,
}: {
  telefone: string;
  // Card do Kanban usa só o ícone (pouco espaço); o drawer mostra o texto.
  comTexto?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard
      .writeText(telefone)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {
        // Clipboard indisponível (HTTP sem TLS, permissão negada) — o número
        // continua visível ao lado pra copiar na mão.
      });
  }

  const Icone = copiado ? Check : Copy;

  if (comTexto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={copiar}>
        <Icone className="size-3.5" />
        {copiado ? "Copiado!" : "Copiar WhatsApp"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copiar}
      aria-label="Copiar WhatsApp"
      title={copiado ? "Copiado!" : "Copiar WhatsApp"}
    >
      <Icone className="size-3.5" />
    </Button>
  );
}
