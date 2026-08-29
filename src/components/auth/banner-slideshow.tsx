"use client";

import { useEffect, useMemo, useState } from "react";
import { getBannersLogin } from "@/app/login/actions";
import type {
  LoginBanner,
  LoginBannerTamanho,
  LoginBannerTextoPosicao,
  LoginBannerTipo,
} from "@/lib/login-banners/schema";

const TROCA_AUTOMATICA_MS = 6000;

// Sombra aplicada via style (não classe utilitária) pra garantir legibilidade
// do texto sobre a imagem do banner sem precisar de uma caixa de fundo
// semi-transparente atrás dele (ver PROBLEMA 2).
const TEXTO_SHADOW = "0 2px 8px rgba(0,0,0,0.8)";

const TITULO_TAMANHO_CLASSES: Record<LoginBannerTamanho, string> = {
  pequeno: "text-2xl",
  medio: "text-4xl",
  grande: "text-6xl",
};

const SUBTITULO_TAMANHO_CLASSES: Record<LoginBannerTamanho, string> = {
  pequeno: "text-sm",
  medio: "text-xl",
  grande: "text-2xl",
};

const TEXTO_POSICAO_CLASSES: Record<LoginBannerTextoPosicao, string> = {
  topo: "justify-start pt-16",
  centro: "justify-center",
  base: "justify-end pb-16",
};

type Slide = {
  key: string;
  imagemUrl: string | null;
  gradiente: string | null;
  emoji: string | null;
  titulo: string | null;
  subtitulo: string | null;
  tituloTamanho: LoginBannerTamanho;
  subtituloTamanho: LoginBannerTamanho;
  tituloCor: string;
  subtituloCor: string;
  textoPosicao: LoginBannerTextoPosicao;
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
    tituloTamanho: "medio",
    subtituloTamanho: "medio",
    tituloCor: "#FFFFFF",
    subtituloCor: "#FFFFFF",
    textoPosicao: "centro",
  },
  {
    key: "placeholder-2",
    imagemUrl: null,
    gradiente: "linear-gradient(135deg, #1a1040, #2196F3)",
    emoji: "📚",
    titulo: "Transforme seu futuro",
    subtitulo: "Cursos presenciais e EAD",
    tituloTamanho: "medio",
    subtituloTamanho: "medio",
    tituloCor: "#FFFFFF",
    subtituloCor: "#FFFFFF",
    textoPosicao: "centro",
  },
  {
    key: "placeholder-3",
    imagemUrl: null,
    gradiente: "linear-gradient(135deg, #0a2018, #2DD4A0)",
    emoji: "🏆",
    titulo: "Certificados de qualidade",
    subtitulo: "Reconhecidos pelo mercado",
    tituloTamanho: "medio",
    subtituloTamanho: "medio",
    tituloCor: "#FFFFFF",
    subtituloCor: "#FFFFFF",
    textoPosicao: "centro",
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
        tituloTamanho: banner.titulo_tamanho,
        subtituloTamanho: banner.subtitulo_tamanho,
        tituloCor: banner.titulo_cor,
        subtituloCor: banner.subtitulo_cor,
        textoPosicao: banner.texto_posicao,
      }));
    }
    return PLACEHOLDERS;
  }, [banners]);

  // `indice` entra nas dependências pra reiniciar a contagem sempre que o
  // slide muda — inclusive quando o usuário clica numa bolinha (setIndice
  // direto, fora do tick automático), garantindo os próximos 6s inteiros
  // a partir da troca manual em vez de um avanço automático "adiantado".
  useEffect(() => {
    if (pausado || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndice((atual) => (atual + 1) % slides.length);
    }, TROCA_AUTOMATICA_MS);
    return () => clearInterval(timer);
  }, [pausado, slides.length, indice]);

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
            <div
              className={`absolute inset-0 flex flex-col items-center px-8 ${TEXTO_POSICAO_CLASSES[slide.textoPosicao]}`}
            >
              {slide.titulo && (
                <span
                  className={`block text-center font-bold ${TITULO_TAMANHO_CLASSES[slide.tituloTamanho]}`}
                  style={{ color: slide.tituloCor, textShadow: TEXTO_SHADOW }}
                >
                  {slide.titulo}
                </span>
              )}
              {slide.subtitulo && (
                <span
                  className={`mt-2 block text-center ${SUBTITULO_TAMANHO_CLASSES[slide.subtituloTamanho]}`}
                  style={{ color: slide.subtituloCor, textShadow: TEXTO_SHADOW }}
                >
                  {slide.subtitulo}
                </span>
              )}
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
