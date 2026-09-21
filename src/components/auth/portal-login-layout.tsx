import type { CSSProperties, ReactNode } from "react";
import { corTextoSobre, hexParaRgba, type PortalLoginConfig } from "@/lib/portal-login/tipos";

// Layout da tela de login do portal do aluno, nos dois templates (cartão e dividido).
// Puramente visual (sem estado): a mesma peça alimenta a tela real (/entrar) e o
// preview do admin — por isso o preview é fiel por construção.
//
// `modo` existe só pro PREVIEW: as quebras responsivas (lg:) dependem da largura da
// JANELA, não da moldura do preview, então ali o modo (desktop/mobile) escolhe o
// layout explicitamente. Na tela real fica indefinido e valem as media queries.

export type ModoPreview = "desktop" | "mobile";

function escolher(modo: ModoPreview | undefined, classes: { mobile: string; desktop: string; responsivo: string }): string {
  return modo === "mobile" ? classes.mobile : modo === "desktop" ? classes.desktop : classes.responsivo;
}

function Logo({ url, tamanho }: { url: string | null; tamanho: "grande" | "pequeno" }) {
  const classe = tamanho === "grande" ? "h-20 max-w-48" : "h-14 max-w-40";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
    return <img src={url} alt="Logo da escola" className={`${classe} object-contain`} />;
  }
  return (
    <div className={`${tamanho === "grande" ? "size-20" : "size-14"} bg-muted border-muted-foreground/30 flex items-center justify-center rounded-2xl border-2 border-dashed`}>
      <span className="text-3xl">🎓</span>
    </div>
  );
}

export function PortalLoginLayout({
  config,
  logoUrl,
  nomeEscola,
  rodape,
  formulario,
  instalarApp,
  heroFallback,
  modo,
}: {
  config: PortalLoginConfig;
  logoUrl: string | null;
  nomeEscola: string;
  rodape?: string | null;
  // O formulário (real ou o de mentirinha do preview).
  formulario: ReactNode;
  // Botão "Instalar App" — só aparece no mobile.
  instalarApp?: ReactNode;
  // Split sem imagem hero: o que mostrar no lugar (ex.: o carrossel de banners existente).
  heroFallback?: ReactNode;
  modo?: ModoPreview;
}) {
  const preview = modo !== undefined;
  const altura = preview ? "h-full" : "min-h-svh";
  const varsCor = {
    "--primary": config.corPrimaria,
    "--primary-foreground": corTextoSobre(config.corPrimaria),
    "--ring": config.corPrimaria,
  } as CSSProperties;

  const cabecalhoFormulario = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{config.titulo}</h1>
      {config.subtitulo && <p className="text-muted-foreground text-sm">{config.subtitulo}</p>}
    </div>
  );

  const blocoInstalar = instalarApp ? (
    <div className={escolher(modo, { mobile: "block", desktop: "hidden", responsivo: "lg:hidden" })}>{instalarApp}</div>
  ) : null;

  const rodapeTexto = rodape ? <p className="text-muted-foreground text-center text-xs">{rodape}</p> : null;

  // ===== Template CARTÃO =====
  if (config.template === "card") {
    const temImagem = !!config.imagemFundoUrl;
    return (
      <main
        style={{
          ...varsCor,
          backgroundColor: config.corFundo,
          ...(temImagem ? { backgroundImage: `url("${config.imagemFundoUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
        }}
        className={`relative flex ${altura} items-center justify-center overflow-hidden p-6`}
      >
        {temImagem && <div aria-hidden className="absolute inset-0" style={{ backgroundColor: hexParaRgba(config.corFundo, 0.55) }} />}
        <div className="bg-background text-foreground relative z-10 flex w-full max-w-sm flex-col gap-6 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <Logo url={logoUrl} tamanho="grande" />
            {cabecalhoFormulario}
          </div>
          {formulario}
          {blocoInstalar}
          {rodapeTexto}
        </div>
      </main>
    );
  }

  // ===== Template DIVIDIDO =====
  const temHero = !!config.imagemFundoUrl;
  return (
    <main
      style={{ ...varsCor, ["--login-fundo" as string]: config.corFundo } as CSSProperties}
      className={`${altura} ${escolher(modo, { mobile: "flex", desktop: "grid grid-cols-2", responsivo: "grid lg:grid-cols-2" })}`}
    >
      {/* Coluna esquerda: hero (só em telas largas). */}
      <div
        className={`relative overflow-hidden ${escolher(modo, { mobile: "hidden", desktop: "flex", responsivo: "hidden lg:flex" })}`}
        style={{
          backgroundColor: config.corFundo,
          ...(temHero ? { backgroundImage: `url("${config.imagemFundoUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
        }}
      >
        {!temHero && heroFallback && <div className="absolute inset-0">{heroFallback}</div>}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${hexParaRgba(config.corFundo, 0.92)}, ${hexParaRgba(config.corFundo, 0.35)} 60%, ${hexParaRgba(config.corFundo, 0.15)})` }}
        />
        <div className="relative z-10 flex h-full w-full flex-col justify-end gap-3 p-10 text-white">
          <Logo url={logoUrl} tamanho="grande" />
          <p className="text-2xl font-bold drop-shadow">{nomeEscola}</p>
        </div>
      </div>

      {/* Coluna direita: formulário. No mobile vira o cartão sobre a cor de fundo. */}
      <div
        className={`flex min-w-0 items-center justify-center p-6 ${escolher(modo, {
          mobile: "w-full bg-[var(--login-fundo)]",
          desktop: "bg-background",
          responsivo: "w-full bg-[var(--login-fundo)] lg:bg-background",
        })}`}
      >
        <div
          className={`text-foreground flex w-full max-w-sm flex-col gap-6 ${escolher(modo, {
            mobile: "bg-background rounded-2xl p-8 shadow-2xl",
            desktop: "",
            responsivo: "bg-background rounded-2xl p-8 shadow-2xl lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none",
          })}`}
        >
          <div className={`flex flex-col items-center gap-4 text-center ${escolher(modo, { mobile: "", desktop: "hidden", responsivo: "lg:hidden" })}`}>
            <Logo url={logoUrl} tamanho="pequeno" />
          </div>
          {cabecalhoFormulario}
          {formulario}
          {blocoInstalar}
          {rodapeTexto}
        </div>
      </div>
    </main>
  );
}
