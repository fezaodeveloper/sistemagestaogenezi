"use client";

// "use client": YouTube IFrame API (script externo + instância imperativa via window.YT),
// estado do player (tempo, volume, velocidade) e localStorage.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ===== Tipos mínimos da YouTube IFrame API (sem @types/youtube — o projeto evita dependências
// novas pra pouca coisa; só o que este componente usa). =====

type YTPlayerState = number;

interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(segundos: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setPlaybackRate(taxa: number): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

type YTPlayerEvento = { target: YTPlayerInstance; data?: YTPlayerState };

interface YTNamespace {
  Player: new (
    elementId: string,
    opcoes: {
      // Sem isso a API cria o iframe com o tamanho fixo padrão (640x390px) — ver comentário
      // onde o player é instanciado, mais abaixo.
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (evento: YTPlayerEvento) => void;
        onStateChange: (evento: YTPlayerEvento) => void;
        onError: (evento: { data: number }) => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Carrega o script da API uma única vez (mesmo com vários players montando/desmontando ao
// navegar entre aulas) — promise compartilhada no módulo. Encadeia um onYouTubeIframeAPIReady
// pré-existente em vez de sobrescrever (a API só chama UM callback global; se algo mais nesta
// página já registrou um, ele ainda precisa rodar).
let promessaApi: Promise<YTNamespace> | null = null;
function carregarYoutubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (promessaApi) return promessaApi;

  promessaApi = new Promise((resolve) => {
    const callbackAnterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      callbackAnterior?.();
      resolve(window.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return promessaApi;
}

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const CHAVE_VELOCIDADE = "genezi-video-velocidade";

function lerVelocidadeSalva(): number {
  try {
    const bruto = localStorage.getItem(CHAVE_VELOCIDADE);
    const valor = bruto ? Number(bruto) : 1;
    return (VELOCIDADES as readonly number[]).includes(valor) ? valor : 1;
  } catch {
    return 1;
  }
}

function salvarVelocidade(valor: number): void {
  try {
    localStorage.setItem(CHAVE_VELOCIDADE, String(valor));
  } catch {
    // Modo privado/storage bloqueado: só não lembra da próxima vez, sem quebrar o player.
  }
}

function formatarTempo(segundosTotais: number): string {
  if (!Number.isFinite(segundosTotais) || segundosTotais < 0) return "0:00";
  const h = Math.floor(segundosTotais / 3600);
  const m = Math.floor((segundosTotais % 3600) / 60);
  const s = Math.floor(segundosTotais % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function YoutubePlayer({
  videoId,
  titulo,
  logoUrl,
  proximaAulaHref,
}: {
  videoId: string;
  titulo: string;
  // Logo discreta no canto do player — mesma "logo tema escuro" da sidebar (Configurações >
  // Personalização); null = não mostra nada (sem espaço reservado vazio).
  logoUrl: string | null;
  // "Próxima aula →" no overlay de fim; ausente/null = aula é a última do curso, o botão some.
  proximaAulaHref?: string | null;
}) {
  const elementoId = `youtube-player-${useId().replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const esconderControlesRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pronto, setPronto] = useState(false);
  const [erroApi, setErroApi] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [volume, setVolume] = useState(100);
  const [mudo, setMudo] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [menuAberto, setMenuAberto] = useState(false);
  const [controlesVisiveis, setControlesVisiveis] = useState(true);
  const [emTelaCheia, setEmTelaCheia] = useState(false);

  // Troca de aula (videoId muda) com o mesmo componente montado (navegação client-side não
  // desmonta a página) precisa resetar o estado do player anterior. Ajuste durante a
  // renderização (padrão recomendado pelo React pra "resetar estado quando uma prop muda"),
  // não dentro do efeito abaixo — setState direto no corpo de um efeito é desaconselhado
  // (react-hooks/set-state-in-effect).
  const [videoIdAnterior, setVideoIdAnterior] = useState(videoId);
  if (videoId !== videoIdAnterior) {
    setVideoIdAnterior(videoId);
    setPronto(false);
    setErroApi(false);
    setTerminado(false);
    setTocando(false);
  }

  // Some com a barra de controles depois de 3s tocando sem interação; qualquer movimento do
  // mouse/toque na área do player reseta o timer. Sempre visível pausado/parado — por isso
  // recebe explicitamente se deve reagendar o auto-ocultar, em vez de ler `tocando` do closure
  // (chamado de dentro do callback onStateChange da API, logo depois de setTocando: o valor
  // fechado de `tocando` ali ainda seria o anterior à atualização). Declarado antes do efeito
  // abaixo, que a referencia.
  const mostrarControlesTemporariamente = useCallback((autoOcultar: boolean) => {
    setControlesVisiveis(true);
    if (esconderControlesRef.current) clearTimeout(esconderControlesRef.current);
    if (autoOcultar) {
      esconderControlesRef.current = setTimeout(() => setControlesVisiveis(false), 3000);
    }
  }, []);

  // Cria o player uma vez (por videoId — troca de aula = novo player) e destrói ao desmontar,
  // pra não acumular instâncias/áudio tocando em segundo plano ao navegar entre aulas.
  useEffect(() => {
    let cancelado = false;

    carregarYoutubeApi()
      .then((YT) => {
        if (cancelado) return;
        // A API substitui a div (#elementoId) por um <iframe> NOVO — nossas classes CSS na div
        // (absolute inset-0) somem junto. Sem width/height "100%" aqui, o iframe nasce com o
        // tamanho fixo padrão da API (640x390px), sobrando fora do container ou espremido no
        // canto — daí o "reforço" logo abaixo, aplicando o mesmo absolute inset-0 diretamente
        // no iframe real via getIframe().
        playerRef.current = new YT.Player(elementoId, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            // A YouTube IFrame API não lê mais este parâmetro (removido pelo YouTube há anos) —
            // mantido só porque foi pedido explicitamente; inofensivo, a API ignora o que não
            // reconhece.
            showinfo: 0,
            iv_load_policy: 3,
            disablekb: 1,
            playsinline: 1,
            // Dentro de useEffect: só roda no client, window sempre existe aqui.
            origin: window.location.origin,
          },
          events: {
            onReady: (evento) => {
              if (cancelado) return;
              // Reforço: garante que o <iframe> de verdade preencha o container mesmo se a API
              // ignorar width/height "100%" (varia por navegador/versão) — sem isso o vídeo fica
              // pequeno, no canto superior esquerdo, do tamanho padrão 640x390px da API.
              const iframe = evento.target.getIframe();
              if (iframe) {
                iframe.style.position = "absolute";
                iframe.style.inset = "0";
                iframe.style.width = "100%";
                iframe.style.height = "100%";
              }
              setPronto(true);
              setDuracao(evento.target.getDuration());
              setVolume(evento.target.getVolume());
              const salva = lerVelocidadeSalva();
              evento.target.setPlaybackRate(salva);
              setVelocidade(salva);
            },
            onStateChange: (evento) => {
              if (cancelado || !window.YT) return;
              if (evento.data === window.YT.PlayerState.PLAYING) {
                setTocando(true);
                setTerminado(false);
                mostrarControlesTemporariamente(true);
              } else if (evento.data === window.YT.PlayerState.PAUSED) {
                setTocando(false);
                mostrarControlesTemporariamente(false);
              } else if (evento.data === window.YT.PlayerState.ENDED) {
                setTocando(false);
                setTerminado(true);
              }
            },
            onError: () => {
              if (!cancelado) setErroApi(true);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelado) setErroApi(true);
      });

    return () => {
      cancelado = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- elementoId é estável (useId); só o videoId deve recriar o player
  }, [videoId]);

  // Atualiza o tempo atual enquanto toca (a API não emite evento contínuo de progresso).
  useEffect(() => {
    if (!tocando) return;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setTempoAtual(player.getCurrentTime());
    }, 250);
    return () => clearInterval(id);
  }, [tocando]);

  useEffect(() => {
    function aoMudarTelaCheia() {
      setEmTelaCheia(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", aoMudarTelaCheia);
    return () => document.removeEventListener("fullscreenchange", aoMudarTelaCheia);
  }, []);

  function alternarPlayPause() {
    const player = playerRef.current;
    if (!player) return;
    if (tocando) player.pauseVideo();
    else player.playVideo();
  }

  function buscarPosicao(evento: React.MouseEvent<HTMLDivElement>) {
    const player = playerRef.current;
    const barra = barraRef.current;
    if (!player || !barra || duracao <= 0) return;
    const retangulo = barra.getBoundingClientRect();
    const fracao = Math.min(1, Math.max(0, (evento.clientX - retangulo.left) / retangulo.width));
    const alvo = fracao * duracao;
    player.seekTo(alvo, true);
    setTempoAtual(alvo);
  }

  function mudarVolume(evento: React.ChangeEvent<HTMLInputElement>) {
    const player = playerRef.current;
    if (!player) return;
    const novoVolume = Number(evento.target.value);
    player.setVolume(novoVolume);
    setVolume(novoVolume);
    if (novoVolume > 0 && mudo) {
      player.unMute();
      setMudo(false);
    }
  }

  function alternarMudo() {
    const player = playerRef.current;
    if (!player) return;
    if (mudo) {
      player.unMute();
      setMudo(false);
    } else {
      player.mute();
      setMudo(true);
    }
  }

  function escolherVelocidade(valor: number) {
    playerRef.current?.setPlaybackRate(valor);
    setVelocidade(valor);
    salvarVelocidade(valor);
    setMenuAberto(false);
  }

  async function alternarTelaCheia() {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch {
      // Navegador sem suporte/permissão pra fullscreen — sem alternativa, ignora.
    }
  }

  function reiniciar() {
    const player = playerRef.current;
    if (!player) return;
    setTerminado(false);
    player.seekTo(0, true);
    player.playVideo();
  }

  const progressoPct = duracao > 0 ? Math.min(100, (tempoAtual / duracao) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="group/player relative aspect-video w-full overflow-hidden rounded-xl bg-black select-none"
      onMouseMove={() => mostrarControlesTemporariamente(tocando)}
      onMouseLeave={() => tocando && setControlesVisiveis(false)}
    >
      {/* A YouTube IFrame API substitui esta div pelo <iframe> real. */}
      <div id={elementoId} className="absolute inset-0" />

      {!pronto && !erroApi && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {erroApi && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-4 text-center">
          <p className="text-sm text-white/80">Não foi possível carregar o vídeo. Recarregue a página.</p>
        </div>
      )}

      {pronto && (
        <>
          {/* Clique em qualquer área do vídeo alterna play/pause (fica atrás da barra de
              controles e do menu de velocidade, que têm z-index maior). */}
          <button
            type="button"
            aria-label={tocando ? "Pausar" : "Reproduzir"}
            onClick={alternarPlayPause}
            className="absolute inset-0 z-10 cursor-pointer"
          />

          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
            <img
              src={logoUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute top-3 left-3 z-20 h-6 max-w-24 object-contain opacity-80 drop-shadow-md"
            />
          )}

          <div className="absolute top-3 right-3 z-20">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Configurações de velocidade"
              onClick={() => setMenuAberto((v) => !v)}
              className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
            >
              <Settings className={cn(tocando && !controlesVisiveis && "opacity-0 transition-opacity", "size-4")} />
            </Button>
            {menuAberto && (
              <div className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full right-0 mt-1 w-32 rounded-lg p-1 text-sm shadow-md ring-1">
                <p className="text-muted-foreground px-2 py-1 text-xs">Velocidade</p>
                {VELOCIDADES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => escolherVelocidade(v)}
                    className={cn(
                      "flex w-full items-center rounded-md px-2 py-1 text-left hover:bg-accent",
                      v === velocidade && "font-semibold text-primary",
                    )}
                  >
                    {v}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {terminado && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
              <p className="text-xl font-semibold text-white">Aula concluída! ✓</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="outline" onClick={reiniciar} className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  Assistir de novo
                </Button>
                {proximaAulaHref && (
                  <Button render={<Link href={proximaAulaHref} />} nativeButton={false}>
                    Próxima aula →
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Barra de controles — não fica atrás do overlay de "clique pra play/pause" (z-20 >
              z-10), senão os controles ficariam inclicáveis. */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-linear-to-t from-black/85 to-transparent px-3 pt-6 pb-2 transition-opacity duration-200",
              controlesVisiveis || !tocando ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div
              ref={barraRef}
              onClick={buscarPosicao}
              role="slider"
              aria-label="Progresso do vídeo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressoPct)}
              tabIndex={0}
              className="group/barra relative h-1.5 w-full cursor-pointer rounded-full bg-white/25"
            >
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${progressoPct}%` }} />
              <div
                className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-blue-500 opacity-0 transition-opacity group-hover/barra:opacity-100"
                style={{ left: `calc(${progressoPct}% - 6px)` }}
              />
            </div>

            <div className="flex items-center gap-3 text-white">
              <button type="button" aria-label={tocando ? "Pausar" : "Reproduzir"} onClick={alternarPlayPause} className="shrink-0">
                {tocando ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>

              <span className="text-xs tabular-nums whitespace-nowrap">
                {formatarTempo(tempoAtual)} / {formatarTempo(duracao)}
              </span>

              <div className="ml-auto flex items-center gap-3">
                <div className="group/volume flex items-center gap-1.5">
                  <button type="button" aria-label={mudo || volume === 0 ? "Ativar som" : "Silenciar"} onClick={alternarMudo}>
                    {mudo || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={mudo ? 0 : volume}
                    onChange={mudarVolume}
                    aria-label="Volume"
                    className="h-1 w-0 accent-blue-500 opacity-0 transition-all group-hover/volume:w-16 group-hover/volume:opacity-100"
                  />
                </div>

                <button type="button" onClick={() => setMenuAberto((v) => !v)} className="text-xs font-medium whitespace-nowrap">
                  {velocidade}x
                </button>

                <button type="button" aria-label={emTelaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={alternarTelaCheia}>
                  {emTelaCheia ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Título acessível (o player não tem mais o <iframe title=...> nativo visível na marcação
          antiga) — leitores de tela ainda precisam saber qual vídeo é este. */}
      <span className="sr-only">Vídeo da aula: {titulo}</span>
    </div>
  );
}
