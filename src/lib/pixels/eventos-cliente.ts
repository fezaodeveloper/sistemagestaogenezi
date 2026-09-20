"use client";

import type { PixelTipo } from "@/lib/pixels/tipos";

// Disparo de eventos pros pixels no NAVEGADOR. Detecta qual plataforma está na
// página (a que o admin cadastrou) e chama a função certa dela:
//
//   evento     Meta                     TikTok               Google Ads                                GA4
//   page_view  fbq('track','PageView')  ttq.page()           gtag('event','page_view',{send_to})       gtag('event','page_view')
//   lead       fbq('track','Lead')      ttq.track('SubmitForm')  gtag('event','conversion',{send_to})  gtag('event','generate_lead')
//
// "Script personalizado" não tem função conhecida: recebe só o CustomEvent
// "genezi:pixel" (detail.evento) — o próprio script pode escutá-lo.

export type EventoPixel = "page_view" | "lead";

export type PixelCliente = {
  tipo: PixelTipo;
  // Google Ads: destino dos eventos.
  sendTo: string | null;
  // O código colado já dispara o page view (não repetir).
  pageViewAutomatico: boolean;
};

type GtagFn = (...args: unknown[]) => void;
type FbqFn = (...args: unknown[]) => void;
type TtqObj = { track: (evento: string, dados?: unknown) => void; page: () => void };

declare global {
  interface Window {
    __geneziPixels?: PixelCliente[];
    fbq?: FbqFn;
    ttq?: TtqObj;
    gtag?: GtagFn;
  }
}

const TENTATIVAS = 25; // 25 x 300ms = 7,5s esperando o script do pixel carregar
const INTERVALO_MS = 300;

// Tenta executar até a biblioteca do pixel existir (os scripts carregam depois da
// hidratação, em ordem não garantida em relação a este código).
function quandoPronto(pronto: () => boolean, executar: () => void, tentativa = 0): void {
  if (pronto()) {
    try {
      executar();
    } catch {
      // Um pixel quebrado nunca pode afetar a página.
    }
    return;
  }
  if (tentativa < TENTATIVAS) setTimeout(() => quandoPronto(pronto, executar, tentativa + 1), INTERVALO_MS);
}

function dispararUm(pixel: PixelCliente, evento: EventoPixel): void {
  if (evento === "page_view" && pixel.pageViewAutomatico) return;

  switch (pixel.tipo) {
    case "meta_ads":
      quandoPronto(
        () => typeof window.fbq === "function",
        () => window.fbq?.("track", evento === "lead" ? "Lead" : "PageView"),
      );
      break;
    case "tiktok_ads":
      quandoPronto(
        () => !!window.ttq && typeof window.ttq.track === "function",
        () => (evento === "lead" ? window.ttq?.track("SubmitForm") : window.ttq?.page()),
      );
      break;
    case "google_ads":
      quandoPronto(
        () => typeof window.gtag === "function",
        () => {
          if (evento === "lead") {
            window.gtag?.("event", "conversion", pixel.sendTo ? { send_to: pixel.sendTo } : undefined);
          } else if (pixel.sendTo) {
            // page_view vai só pro ID da conta (o rótulo "/xxxx" é de uma conversão específica).
            window.gtag?.("event", "page_view", { send_to: pixel.sendTo.split("/")[0] });
          }
        },
      );
      break;
    case "google_analytics":
      quandoPronto(
        () => typeof window.gtag === "function",
        () => window.gtag?.("event", evento === "lead" ? "generate_lead" : "page_view"),
      );
      break;
    case "script_personalizado":
      break;
  }
}

export function registrarPixelsCliente(pixels: PixelCliente[]): void {
  window.__geneziPixels = pixels;
}

// Chamada pelas páginas: "page_view" ao carregar (PixelEventos) e "lead" quando o
// formulário é enviado com sucesso. Sem pixels na página, não faz nada.
export function dispararEventoPixels(evento: EventoPixel): void {
  if (typeof window === "undefined") return;
  const pixels = window.__geneziPixels ?? [];
  if (pixels.length === 0) return;

  for (const pixel of pixels) dispararUm(pixel, evento);
  if (pixels.some((pixel) => pixel.tipo === "script_personalizado")) {
    window.dispatchEvent(new CustomEvent("genezi:pixel", { detail: { evento } }));
  }
}
