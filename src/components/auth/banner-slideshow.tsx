"use client";

import { useEffect, useMemo, useState } from "react";
import { getBannersLogin } from "@/app/login/actions";
import type { LoginBanner, LoginBannerTipo } from "@/lib/login-banners/schema";

const TROCA_AUTOMATICA_MS = 10000;

type Slide = {
  key: string;
  imagemUrl: string | null;
  gradiente: string | null;
  emoji: string | null;
  titulo: string | null;
  subtitulo: string | null;
};

// Placeholders com a identidade visual da Gênezi — usados só enquanto não
// há banners cadastrados no banco (ver TAREFA 2). Implementados como
// gradiente CSS + texto (não um <svg> literal): mesmo resultado visual,
// mais simples e sem os problemas de renderização de fonte que <text> em
// SVG costuma ter.
const PLACEHOLDERS: Slide[] = [
  {
    key: "placeholder-1",
    imagemUrl: null,
    gradiente: "linear-gradient(135deg, #0A1220, #22D3EE)",
    emoji: "🎓",
    titulo: "GÊNEZI",
    subtitulo: "Educação Profissional",
  },
  {
    key: "placeholder-2",
    imagemUrl: null,
    gradiente: "linear-gradient(135deg, #1a1040, #2196F3)",
    emoji: "📚",
    titulo: "Transforme seu futuro",
    subtitulo: "Cursos presenciais e EAD",
  },
  {
    key: "placeholder-3",
    imagemUrl: null,
    gradiente: "linear-gradient(135deg, #0a2018, #2DD4A0)",
    emoji: "🏆",
    titulo: "Certificados de qualidade",
    subtitulo: "Reconhecidos pelo mercado",
  },
];

export function BannerSlideshow({ tipo }: { tipo: LoginBannerTipo }) {
  const [banners, setBanners] = useState<LoginBanner[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    getBannersLogin(tipo).then((dados) => {
      if (!cancelado) setBanners(dados);
    });
    return () => {
      cancelado = true;
    };
  }, [tipo]);

  // null (ainda carregando) e [] (nenhum banner cadastrado) caem no mesmo
  // fallback — evita o slideshow "piscar" placeholder → real na primeira
  // renderização quando já existem banners cadastrados.
  const slides: Slide[] = useMemo(() => {
    if (banners && banners.length > 0) {
      return banners.map((banner) => ({
        key: banner.id,
        imagemUrl: banner.public_url,
        gradiente: null,
        emoji: null,
        titulo: banner.titulo,
        subtitulo: banner.subtitulo,
      }));
    }
    return PLACEHOLDERS;
  }, [banners]);

  useEffect(() => {
    if (pausado || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndice((atual) => (atual + 1) % slides.length);
    }, TROCA_AUTOMATICA_MS);
    return () => clearInterval(timer);
  }, [pausado, slides.length]);

  // Módulo em vez de um efeito corretivo: se a lista de slides mudar (ex.:
  // placeholders → banners reais depois do fetch) e o índice guardado
  // ficar fora do novo intervalo, isso já resolve pro primeiro slide na
  // própria renderização, sem precisar de um setState em efeito.
  const indiceSeguro = slides.length > 0 ? indice % slides.length : 0;

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {slides.map((slide, posicao) => (
        <div
          key={slide.key}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: posicao === indiceSeguro ? 1 : 0,
            backgroundImage: slide.imagemUrl ? `url(${slide.imagemUrl})` : slide.gradiente ?? undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden={posicao !== indiceSeguro}
        >
          {slide.gradiente && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
              {slide.emoji && <span className="text-6xl">{slide.emoji}</span>}
              {slide.titulo && (
                <span className="text-4xl font-bold text-white drop-shadow-md">{slide.titulo}</span>
              )}
              {slide.subtitulo && <span className="text-lg text-white/80">{slide.subtitulo}</span>}
            </div>
          )}

          {slide.imagemUrl && (slide.titulo || slide.subtitulo) && (
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-8 pt-16">
              {slide.titulo && <span className="block text-2xl font-bold text-white">{slide.titulo}</span>}
              {slide.subtitulo && <span className="block text-sm text-white/80">{slide.subtitulo}</span>}
            </div>
          )}
        </div>
      ))}

      {/* Logo em overlay, canto superior esquerdo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-[17px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #22D3EE, #1565C0)" }}
        >
          G
        </div>
        <span className="text-sm font-bold tracking-wide text-white drop-shadow">GÊNEZI</span>
      </div>

      {/* Indicadores de slide */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((slide, posicao) => (
            <button
              key={slide.key}
              type="button"
              aria-label={`Ir para o slide ${posicao + 1}`}
              onClick={() => setIndice(posicao)}
              className={`h-2 rounded-full transition-all ${
                posicao === indiceSeguro ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
