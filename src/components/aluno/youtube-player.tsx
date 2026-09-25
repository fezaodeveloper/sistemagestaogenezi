"use client";

// "use client": YouTube IFrame API (script externo + instância imperativa via window.YT),
// estado do player (tempo, volume, velocidade) e localStorage.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  FastForward,
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  Play,
  Rewind,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EVENTO_AULA_CONCLUIDA_ALTERADA } from "@/components/aluno/toggle-aula-concluida-button";

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
  getAvailableQualityLevels(): string[];
  getPlaybackQuality(): string;
  setPlaybackQuality(qualidade: string): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

type YTPlayerEvento = { target: YTPlayerInstance; data?: YTPlayerState };
type YTPlayerEventoQualidade = { target: YTPlayerInstance; data: string };

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
        onPlaybackQualityChange: (evento: YTPlayerEventoQualidade) => void;
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

// Rótulos na ordem em que a API costuma retornar getAvailableQualityLevels() (da maior pra
// menor) — "highres"/"hd2160"/"hd1440" só aparecem se o vídeo de fato tiver essas resoluções.
// A partir de ~2018 o YouTube ignora setPlaybackQuality() na maioria dos vídeos (ele mesmo decide
// pela largura de banda), mas o método continua existindo e não lança — a troca ainda funciona
// pra parte dos vídeos/contas, e o pedido foi implementar o seletor de qualquer forma.
const QUALIDADE_LABELS: Record<string, string> = {
  highres: "Máxima",
  hd2160: "2160p (4K)",
  hd1440: "1440p (2K)",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  auto: "Automática",
};

const CHAVE_QUALIDADE = "genezi-video-qualidade";

function lerQualidadeSalva(): string | null {
  try {
    return localStorage.getItem(CHAVE_QUALIDADE);
  } catch {
    return null;
  }
}

function salvarQualidade(valor: string): void {
  try {
    localStorage.setItem(CHAVE_QUALIDADE, valor);
  } catch {
    // Modo privado/storage bloqueado: só não lembra da próxima vez, sem quebrar o player.
  }
}

// Uma chave por vídeo (não por aula) — "genezi-video-pos-{videoId}" — combinada com "só oferece
// retomar se sobrar mais de 10s de vídeo" evita o prompt bobo de "continuar do início" ou
// "continuar faltando 2s" logo depois que o aluno já quase terminou.
const PREFIXO_CHAVE_POSICAO = "genezi-video-pos-";
const POSICAO_MINIMA_PARA_RETOMAR = 10; // segundos já assistidos

function chavePosicao(videoId: string): string {
  return `${PREFIXO_CHAVE_POSICAO}${videoId}`;
}

function lerPosicaoSalva(videoId: string): number | null {
  try {
    const bruto = localStorage.getItem(chavePosicao(videoId));
    const valor = bruto ? Number(bruto) : NaN;
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
}

function salvarPosicao(videoId: string, segundos: number): void {
  try {
    localStorage.setItem(chavePosicao(videoId), String(Math.floor(segundos)));
  } catch {
    // Modo privado/storage bloqueado: só não lembra a posição, sem quebrar o player.
  }
}

function limparPosicaoSalva(videoId: string): void {
  try {
    localStorage.removeItem(chavePosicao(videoId));
  } catch {
    // Idem acima.
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
  // getIframe() (mesmo elemento usado no reforço de tamanho, ver onReady) — guardado à parte pra
  // poder MOVER esse mesmo iframe pro miniplayer flutuante e de volta, sem criar uma segunda
  // instância do player (que tocaria o vídeo duas vezes/travaria o layout).
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const miniSlotRef = useRef<HTMLDivElement | null>(null);
  const ultimoSalvamentoPosicaoRef = useRef(0);

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
  const [qualidadesDisponiveis, setQualidadesDisponiveis] = useState<string[]>([]);
  const [qualidadeAtual, setQualidadeAtual] = useState<string | null>(null);
  const [controlesVisiveis, setControlesVisiveis] = useState(true);
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  // Prompt "Continuar de MM:SS?" — null = não tem posição salva ou já resolveu (Sim/Não).
  const [posicaoSalva, setPosicaoSalva] = useState<number | null>(null);
  const [foraDaTela, setForaDaTela] = useState(false);
  const [miniplayerFechado, setMiniplayerFechado] = useState(false);
  const mostrarMiniplayer = foraDaTela && pronto && !terminado && !miniplayerFechado;

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
    setPosicaoSalva(null);
    setMiniplayerFechado(false);
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
            // Dentro de useEffect: só roda no client, window sempre existe aqui. Já era
            // dinâmico (nunca hardcoded) — o erro "target origin ... does not match" que ainda
            // aparece no console mesmo com origin correto é um warning conhecido e inofensivo do
            // próprio IFrame API do YouTube (troca de postMessage interna da API antes do handshake
            // terminar), não afeta a reprodução; não há como suprimir isso do lado do embedder.
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

              const disponiveis = evento.target.getAvailableQualityLevels();
              setQualidadesDisponiveis(disponiveis);
              const qualidadeSalva = lerQualidadeSalva();
              if (qualidadeSalva && disponiveis.includes(qualidadeSalva)) {
                evento.target.setPlaybackQuality(qualidadeSalva);
                setQualidadeAtual(qualidadeSalva);
              } else {
                setQualidadeAtual(evento.target.getPlaybackQuality());
              }

              iframeRef.current = iframe;

              // Retomar de onde parou: só oferece se sobra vídeo suficiente pra valer a pena
              // (não é "continuar" se faltam só alguns segundos).
              const posicaoSalvaDetectada = lerPosicaoSalva(videoId);
              const duracaoVideo = evento.target.getDuration();
              if (
                posicaoSalvaDetectada &&
                posicaoSalvaDetectada >= POSICAO_MINIMA_PARA_RETOMAR &&
                posicaoSalvaDetectada < duracaoVideo - 5
              ) {
                setPosicaoSalva(posicaoSalvaDetectada);
              } else if (posicaoSalvaDetectada) {
                limparPosicaoSalva(videoId);
              }
            },
            onPlaybackQualityChange: (evento) => {
              if (cancelado) return;
              // O YouTube pode ajustar a qualidade sozinho (rede/buffer) mesmo depois de
              // setPlaybackQuality — mantém o menu refletindo a qualidade real em uso.
              setQualidadeAtual(evento.data);
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
                salvarPosicao(videoId, evento.target.getCurrentTime());
              } else if (evento.data === window.YT.PlayerState.ENDED) {
                setTocando(false);
                setTerminado(true);
                limparPosicaoSalva(videoId);
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

  // Atualiza o tempo atual enquanto toca (a API não emite evento contínuo de progresso). Também
  // salva a posição a cada 5s tocando (retomar de onde parou) — reaproveita este mesmo intervalo
  // em vez de criar um segundo setInterval só pra isso.
  useEffect(() => {
    if (!tocando) return;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const atual = player.getCurrentTime();
      setTempoAtual(atual);

      const agora = Date.now();
      if (agora - ultimoSalvamentoPosicaoRef.current >= 5000) {
        ultimoSalvamentoPosicaoRef.current = agora;
        salvarPosicao(videoId, atual);
      }
    }, 250);
    return () => clearInterval(id);
  }, [tocando, videoId]);

  useEffect(() => {
    function aoMudarTelaCheia() {
      setEmTelaCheia(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", aoMudarTelaCheia);
    return () => document.removeEventListener("fullscreenchange", aoMudarTelaCheia);
  }, []);

  // ToggleAulaConcluidaButton (irmão na barra de ações) dispara isto ao marcar a aula como
  // concluída — não faz sentido oferecer "continuar de onde parou" numa aula já concluída.
  useEffect(() => {
    function aoAlterarConclusao(evento: Event) {
      const { concluida } = (evento as CustomEvent<{ concluida: boolean }>).detail;
      if (concluida) {
        limparPosicaoSalva(videoId);
        setPosicaoSalva(null);
      }
    }
    window.addEventListener(EVENTO_AULA_CONCLUIDA_ALTERADA, aoAlterarConclusao);
    return () => window.removeEventListener(EVENTO_AULA_CONCLUIDA_ALTERADA, aoAlterarConclusao);
  }, [videoId]);

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

  function escolherQualidade(valor: string) {
    playerRef.current?.setPlaybackQuality(valor);
    setQualidadeAtual(valor);
    salvarQualidade(valor);
    setMenuAberto(false);
  }

  // Compartilhado pelos botões ⏪/⏩ da barra de controles e pelas setas do teclado.
  function pular(delta: number) {
    const player = playerRef.current;
    if (!player) return;
    const novo = Math.min(duracao, Math.max(0, player.getCurrentTime() + delta));
    player.seekTo(novo, true);
    setTempoAtual(novo);
  }

  function continuarDePosicaoSalva() {
    const player = playerRef.current;
    if (player && posicaoSalva !== null) {
      player.seekTo(posicaoSalva, true);
      player.playVideo();
    }
    setPosicaoSalva(null);
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

  // Atalhos de teclado — globais na página (não só quando o player está focado), pra funcionar
  // assim que a aula abre sem precisar clicar no vídeo antes. Por isso o guard logo no início:
  // ignora a tecla se o foco está num campo de formulário da MESMA página (textarea de
  // comentário/avaliação da aula, um input de busca etc.) — senão, por exemplo, apertar espaço
  // pra digitar um comentário pausaria o vídeo sem querer.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable)) {
        return;
      }
      const player = playerRef.current;
      if (!player || !pronto) return;

      if (evento.key === " " || evento.code === "Space") {
        evento.preventDefault();
        if (tocando) player.pauseVideo();
        else player.playVideo();
      } else if (evento.key === "ArrowRight") {
        evento.preventDefault();
        pular(10);
      } else if (evento.key === "ArrowLeft") {
        evento.preventDefault();
        pular(-10);
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        const novoVolume = Math.min(100, (mudo ? 0 : volume) + 10);
        player.setVolume(novoVolume);
        setVolume(novoVolume);
        if (mudo) {
          player.unMute();
          setMudo(false);
        }
      } else if (evento.key === "ArrowDown") {
        evento.preventDefault();
        const novoVolume = Math.max(0, (mudo ? 0 : volume) - 10);
        player.setVolume(novoVolume);
        setVolume(novoVolume);
      } else if (evento.key === "m" || evento.key === "M") {
        alternarMudo();
      } else if (evento.key === "f" || evento.key === "F") {
        void alternarTelaCheia();
      } else if (/^[0-9]$/.test(evento.key)) {
        // 0-9 = 0%-90% do vídeo (padrão de player de vídeo consagrado — YouTube.com faz o mesmo).
        evento.preventDefault();
        const novo = (Number(evento.key) / 10) * duracao;
        player.seekTo(novo, true);
        setTempoAtual(novo);
      } else {
        return;
      }
      mostrarControlesTemporariamente(tocando);
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pular/alternarMudo/alternarTelaCheia não são memoizadas; listadas via closure, reinscrever a cada render é barato (só um listener)
  }, [pronto, tocando, volume, mudo, duracao, mostrarControlesTemporariamente]);

  // Miniplayer flutuante: quando o player principal sai da viewport (aluno rolou a página),
  // marca foraDaTela — o efeito seguinte (que reage a essa mudança) MOVE o <iframe> de verdade
  // pro miniplayer, em vez de criar uma segunda instância do player (tocaria o vídeo em
  // duplicado). threshold 0 = já considera "fora" assim que nenhum pixel do player está visível.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entrada]) => {
        setForaDaTela(!entrada.isIntersecting);
        if (entrada.isIntersecting) setMiniplayerFechado(false);
      },
      { threshold: 0 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Move o <iframe> real entre o slot principal (dentro de containerRef) e o slot do miniplayer
  // conforme mostrarMiniplayer muda — appendChild/prepend em nó já existente no documento não
  // recarrega o iframe (diferente de trocar innerHTML ou o atributo src).
  useEffect(() => {
    const iframe = iframeRef.current;
    const container = containerRef.current;
    if (!iframe || !container) return;

    if (mostrarMiniplayer && miniSlotRef.current) {
      miniSlotRef.current.appendChild(iframe);
    } else if (!mostrarMiniplayer && iframe.parentElement !== container) {
      // prepend (não appendChild): o iframe precisa voltar a ser o PRIMEIRO filho do container,
      // senão fica por cima da barra de controles/overlays (que não têm z-index maior que "auto"
      // + ordem no DOM decide o empate de camadas).
      container.prepend(iframe);
    }
  }, [mostrarMiniplayer]);

  function fecharMiniplayer(evento: React.MouseEvent) {
    evento.stopPropagation();
    setMiniplayerFechado(true);
  }

  function irParaPlayerPrincipal() {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const progressoPct = duracao > 0 ? Math.min(100, (tempoAtual / duracao) * 100) : 0;

  return (
    <>
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
              <div className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full right-0 mt-1 w-40 rounded-lg p-1 text-sm shadow-md ring-1">
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

                {qualidadesDisponiveis.length > 0 && (
                  <>
                    <p className="text-muted-foreground mt-1 border-t px-2 pt-2 pb-1 text-xs">Qualidade</p>
                    {qualidadesDisponiveis.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => escolherQualidade(q)}
                        className={cn(
                          "flex w-full items-center rounded-md px-2 py-1 text-left hover:bg-accent",
                          q === qualidadeAtual && "font-semibold text-primary",
                        )}
                      >
                        {QUALIDADE_LABELS[q] ?? q}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Discreto de propósito: canto oposto ao menu de velocidade/qualidade, só aparece no
              hover do player inteiro (group/player), some sozinho o resto do tempo. */}
          <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-md bg-black/60 px-2.5 py-1 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity group-hover/player:opacity-100">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="size-3" /> Espaço play/pause · ←/→ 10s · ↑/↓ volume · M mudo · F tela cheia · 0-9 ir para %
            </span>
          </div>

          {posicaoSalva !== null && !terminado && (
            <div className="absolute top-14 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-sm text-white shadow-md">
              <span>Continuar de {formatarTempo(posicaoSalva)}?</span>
              <Button type="button" size="sm" onClick={continuarDePosicaoSalva}>
                Sim
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setPosicaoSalva(null)}
              >
                Não
              </Button>
            </div>
          )}

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
              <button type="button" aria-label="Voltar 10 segundos" onClick={() => pular(-10)} className="shrink-0">
                <Rewind className="size-4 fill-current" />
              </button>

              <button type="button" aria-label={tocando ? "Pausar" : "Reproduzir"} onClick={alternarPlayPause} className="shrink-0">
                {tocando ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>

              <button type="button" aria-label="Avançar 10 segundos" onClick={() => pular(10)} className="shrink-0">
                <FastForward className="size-4 fill-current" />
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

    {/* Miniplayer flutuante: position fixed relativo à viewport (não a containerRef), por isso é
        renderizado fora dele, como irmão. Mesmo <iframe> do player principal — reparentado pelos
        efeitos acima, nunca duplicado. */}
    {mostrarMiniplayer && (
      <div
        className="fixed right-4 bottom-4 z-50 w-70 cursor-pointer overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10"
        onClick={irParaPlayerPrincipal}
        role="button"
        tabIndex={0}
        aria-label="Voltar ao player"
      >
        <div ref={miniSlotRef} className="relative aspect-video w-full" />

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-2 py-1">
          <button
            type="button"
            aria-label={tocando ? "Pausar" : "Reproduzir"}
            onClick={(evento) => {
              evento.stopPropagation();
              alternarPlayPause();
            }}
            className="text-white"
          >
            {tocando ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          </button>
          <button type="button" aria-label="Fechar miniplayer" onClick={fecharMiniplayer} className="text-white">
            <X className="size-4" />
          </button>
        </div>
      </div>
    )}
    </>
  );
}
