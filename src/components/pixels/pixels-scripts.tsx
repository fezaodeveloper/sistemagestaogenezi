import Script from "next/script";
import { analisarScript } from "@/lib/pixels/analisar";
import type { PixelParaPagina } from "@/lib/pixels/injetar";
import { PixelEventos } from "@/components/pixels/pixel-eventos";

// Injeta os pixels ativos na página pública. Server Component: o código do admin
// vai no HTML/JS da página e RODA NO NAVEGADOR (strategy afterInteractive), nunca
// no servidor.
//
// App Router não tem next/head: o next/script é o meio de colocar <script> na página
// com execução garantida (inclusive em navegação client-side, onde <script> vindo
// de innerHTML não rodaria). O corpo dos scripts inline entra via
// dangerouslySetInnerHTML — é código colado por um ADMIN (só ele escreve em
// pixels_config), tratado como conteúdo de confiança.
export function PixelsScripts({ pixels }: { pixels: PixelParaPagina[] }) {
  if (pixels.length === 0) return null;

  return (
    <>
      {pixels.map((pixel) => {
        const { partes, noscripts } = analisarScript(pixel.script);
        return (
          <div key={pixel.id} hidden>
            {partes.map((parte, indice) =>
              parte.tipo === "externo" ? (
                <Script key={`${pixel.id}-${indice}`} id={`pixel-${pixel.id}-${indice}`} src={parte.src} strategy="afterInteractive" />
              ) : (
                <Script
                  key={`${pixel.id}-${indice}`}
                  id={`pixel-${pixel.id}-${indice}`}
                  strategy="afterInteractive"
                  dangerouslySetInnerHTML={{ __html: parte.codigo }}
                />
              ),
            )}
            {noscripts.map((interno, indice) => (
              <noscript key={`ns-${pixel.id}-${indice}`} dangerouslySetInnerHTML={{ __html: interno }} />
            ))}
          </div>
        );
      })}

      <PixelEventos
        pixels={pixels.map((pixel) => ({ tipo: pixel.tipo, sendTo: pixel.sendTo, pageViewAutomatico: pixel.pageViewAutomatico }))}
      />
    </>
  );
}
