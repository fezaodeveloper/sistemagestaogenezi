"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBannersPortal } from "@/app/aluno/actions";
import type { LoginBanner } from "@/lib/login-banners/schema";

const INTERVALO_PADRAO_SEGUNDOS = 6;

// Mesma sombra de texto usada em BannerSlideshow (src/components/auth/) —
// garante legibilidade sobre a imagem sem caixa de fundo atrás do texto.
const TEXTO_SHADOW = "0 2px 8px rgba(0,0,0,0.8)";

// Componente separado do BannerSlideshow de login (não reutilizado
// diretamente): tipo de banner diferente ('portal'), altura compacta, sem
// placeholders e sem logo — reaproveitar o mesmo componente exigiria
// props condicionais pra cada uma dessas diferenças, mais complexo que
// duplicar a lógica de troca automática/indicadores.
export function BannerSlideshowPortal() {
  const [banners, setBanners] = useState<LoginBanner[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    getBannersPortal().then((dados) => {
      if (!cancelado) setBanners(dados);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Intervalo do primeiro banner define o tempo de troca de todo o
  // slideshow (mais simples que uma média por slide, e cobre o caso comum
  // de todos os banners usando o mesmo valor).
  const intervaloMs = (banners?.[0]?.intervalo_segundos ?? INTERVALO_PADRAO_SEGUNDOS) * 1000;

  useEffect(() => {
    if (pausado || !banners || banners.length <= 1) return;
    const timer = setInterval(() => {
      setIndice((atual) => (atual + 1) % banners.length);
    }, intervaloMs);
    return () => clearInterval(timer);
  }, [pausado, banners, indice, intervaloMs]);

  if (!banners || banners.length === 0) return null;

  const indiceSeguro = indice % banners.length;

  function irParaAnterior() {
    setIndice((atual) => (atual - 1 + banners!.length) % banners!.length);
  }

  function irParaProximo() {
    setIndice((atual) => (atual + 1) % banners!.length);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative h-40 w-full overflow-hidden rounded-xl sm:h-48"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
      >
        {banners.map((banner, posicao) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${banner.link_url ? "cursor-pointer" : ""}`}
            style={{
              opacity: posicao === indiceSeguro ? 1 : 0,
              pointerEvents: posicao === indiceSeguro ? "auto" : "none",
              backgroundImage: `url(${banner.public_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            aria-hidden={posicao !== indiceSeguro}
            onClick={() => {
              if (banner.link_url) window.open(banner.link_url, "_blank", "noopener,noreferrer");
            }}
          >
            {(banner.titulo || banner.subtitulo) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
                {banner.titulo && (
                  <span
                    className="block text-xl font-bold sm:text-2xl"
                    style={{ color: banner.titulo_cor, textShadow: TEXTO_SHADOW }}
                  >
                    {banner.titulo}
                  </span>
                )}
                {banner.subtitulo && (
                  <span
                    className="block text-sm sm:text-base"
                    style={{ color: banner.subtitulo_cor, textShadow: TEXTO_SHADOW }}
                  >
                    {banner.subtitulo}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Slide anterior"
              onClick={(event) => {
                event.stopPropagation();
                irParaAnterior();
              }}
              className="absolute top-1/2 left-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70 sm:size-9"
            >
              <ChevronLeft className="size-4 sm:size-5" />
            </button>
            <button
              type="button"
              aria-label="Próximo slide"
              onClick={(event) => {
                event.stopPropagation();
                irParaProximo();
              }}
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70 sm:size-9"
            >
              <ChevronRight className="size-4 sm:size-5" />
            </button>
          </>
        )}
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-2">
          {banners.map((banner, posicao) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Ir para o slide ${posicao + 1}`}
              onClick={() => setIndice(posicao)}
              className={`h-1.5 rounded-full transition-all ${
                posicao === indiceSeguro ? "w-6 bg-foreground" : "w-1.5 bg-foreground/30 hover:bg-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
