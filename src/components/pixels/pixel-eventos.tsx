"use client";

// "use client": registra os pixels da página no navegador e dispara o page_view.

import { useEffect } from "react";
import { dispararEventoPixels, registrarPixelsCliente, type PixelCliente } from "@/lib/pixels/eventos-cliente";

export function PixelEventos({ pixels }: { pixels: PixelCliente[] }) {
  // Chave estável: o array chega novo a cada render do servidor.
  const chave = JSON.stringify(pixels);

  useEffect(() => {
    registrarPixelsCliente(JSON.parse(chave) as PixelCliente[]);
    dispararEventoPixels("page_view");
    return () => registrarPixelsCliente([]);
  }, [chave]);

  return null;
}
