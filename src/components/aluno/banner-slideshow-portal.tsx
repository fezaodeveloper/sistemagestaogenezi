"use client";

import { useEffect, useState } from "react";
import { getBannersPortal } from "@/app/aluno/actions";
import type { LoginBanner } from "@/lib/login-banners/schema";

const TROCA_AUTOMATICA_MS = 6000;

// Mesma sombra de texto usada em BannerSlideshow (src/components/auth/) —
// garante legibilidade sobre a imagem sem caixa de fundo atrás do texto.
const TEXTO_SHADOW = "0 2px 8px rgba(0,0,0,0.8)";

// O schema de login_banners não tem um campo de link dedicado — pra permitir
// banner clicável sem alterar schema, o link é detectado direto no texto do
// título (ex.: título "Promoção — saiba mais em wa.me/551199999999").
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

function extrairLink(titulo: string | null): string | null {
  if (!titulo) return null;
  const match = titulo.match(URL_REGEX);
  if (!match) return null;
  return match[0].startsWith("http") ? match[0] : `https://${match[0]}`;
}

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

  useEffect(() => {
    if (pausado || !banners || banners.length <= 1) return;
    const timer = setInterval(() => {
      setIndice((atual) => (atual + 1) % banners.length);
    }, TROCA_AUTOMATICA_MS);
    return () => clearInterval(timer);
  }, [pausado, banners, indice]);

  if (!banners || banners.length === 0) return null;

  const indiceSeguro = indice % banners.length;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative h-40 w-full overflow-hidden rounded-xl sm:h-48"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
      >
        {banners.map((banner, posicao) => {
          const link = extrairLink(banner.titulo);
          return (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${link ? "cursor-pointer" : ""}`}
              style={{
                opacity: posicao === indiceSeguro ? 1 : 0,
                pointerEvents: posicao === indiceSeguro ? "auto" : "none",
                backgroundImage: `url(${banner.public_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-hidden={posicao !== indiceSeguro}
              onClick={() => {
                if (link) window.open(link, "_blank", "noopener,noreferrer");
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
          );
        })}
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
