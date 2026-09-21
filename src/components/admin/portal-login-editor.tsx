"use client";

// "use client": formulário com estado, upload da imagem, preview em tempo real e Server Action.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Smartphone, Trash2, Upload } from "lucide-react";
import { salvarPortalLogin } from "@/app/admin/configuracoes/portal-aluno/login/actions";
import { createClient } from "@/lib/supabase/client";
import { BANNER_BUCKET, BANNER_TAMANHO_MAXIMO_BYTES, BANNER_TIPOS_ACEITOS } from "@/lib/storage/banners";
import {
  PORTAL_LOGIN_TEMPLATES,
  PORTAL_LOGIN_TEMPLATE_LABELS,
  PORTAL_LOGIN_TIPOS_SENHA,
  PORTAL_LOGIN_TIPO_SENHA_INFO,
  REGEX_COR_HEX,
  type PortalLoginConfig,
  type PortalLoginTemplate,
  type PortalLoginTipoSenha,
} from "@/lib/portal-login/tipos";
import { PortalLoginLayout, type ModoPreview } from "@/components/auth/portal-login-layout";
import { AlunoLoginFormPreview } from "@/components/auth/aluno-login-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const EXTENSAO_POR_TIPO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Tamanhos "reais" em que o preview é desenhado antes de ser reduzido pra caber na coluna.
const MOLDURA: Record<ModoPreview, { largura: number; altura: number }> = {
  desktop: { largura: 1100, altura: 680 },
  mobile: { largura: 390, altura: 760 },
};

function CampoCor({ id, rotulo, valor, onChange }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void }) {
  const valido = REGEX_COR_HEX.test(valor);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${rotulo} (seletor)`}
          value={valido ? valor : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="border-input h-9 w-14 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input id={id} value={valor} maxLength={7} className="w-28 font-mono" aria-invalid={!valido} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function PortalLoginEditor({
  inicial,
  senhaPadraoInicial,
  logoUrl,
  nomeEscola,
  rodape,
  criptografiaConfigurada,
}: {
  inicial: PortalLoginConfig;
  senhaPadraoInicial: string;
  logoUrl: string | null;
  nomeEscola: string;
  rodape: string | null;
  criptografiaConfigurada: boolean;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<PortalLoginTemplate>(inicial.template);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [subtitulo, setSubtitulo] = useState(inicial.subtitulo);
  const [corPrimaria, setCorPrimaria] = useState(inicial.corPrimaria);
  const [corFundo, setCorFundo] = useState(inicial.corFundo);
  const [imagemUrl, setImagemUrl] = useState(inicial.imagemFundoUrl ?? "");
  const [tipoSenha, setTipoSenha] = useState<PortalLoginTipoSenha>(inicial.tipoSenha);
  const [senhaPadrao, setSenhaPadrao] = useState(senhaPadraoInicial);
  const [mostrarInstalar, setMostrarInstalar] = useState(inicial.mostrarInstalarApp);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Preview: modo e escala (a moldura é desenhada no tamanho real e reduzida pra coluna).
  const [modo, setModo] = useState<ModoPreview>("desktop");
  const [larguraColuna, setLarguraColuna] = useState(0);
  const colunaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const elemento = colunaRef.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => setLarguraColuna(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const moldura = MOLDURA[modo];
  // Mobile: também limita pela altura, pra não virar uma torre.
  const escala = larguraColuna > 0 ? Math.min(1, larguraColuna / moldura.largura, modo === "mobile" ? 560 / moldura.altura : 1) : 0;

  // Config "ao vivo" alimentando o MESMO layout da tela real.
  const configPreview: PortalLoginConfig = {
    template,
    titulo: titulo || "Área do Aluno",
    subtitulo,
    corPrimaria: REGEX_COR_HEX.test(corPrimaria) ? corPrimaria : inicial.corPrimaria,
    corFundo: REGEX_COR_HEX.test(corFundo) ? corFundo : inicial.corFundo,
    imagemFundoUrl: imagemUrl || null,
    tipoSenha,
    mostrarInstalarApp: mostrarInstalar,
  };

  async function handleArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!arquivo) return;
    setErro(null);

    if (!(BANNER_TIPOS_ACEITOS as readonly string[]).includes(arquivo.type)) {
      setErro("Formato não aceito. Use JPG, PNG ou WebP.");
      return;
    }
    if (arquivo.size > BANNER_TAMANHO_MAXIMO_BYTES) {
      setErro("Arquivo muito grande. Máximo permitido: 5MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      // Reaproveita o bucket público "login-banners" (upload restrito a admin). Nome com
      // carimbo: cada imagem tem URL própria (sem cache velho do navegador).
      const caminho = `portal-aluno/fundo-${Date.now()}.${EXTENSAO_POR_TIPO[arquivo.type]}`;
      const { error } = await supabase.storage.from(BANNER_BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: "3600" });
      if (error) {
        setErro(`Erro no upload: ${error.message}`);
        return;
      }
      setImagemUrl(supabase.storage.from(BANNER_BUCKET).getPublicUrl(caminho).data.publicUrl);
    } finally {
      setEnviando(false);
    }
  }

  function handleSalvar() {
    setErro(null);
    setSalvo(false);
    startSalvar(async () => {
      const r = await salvarPortalLogin({
        template,
        titulo,
        subtitulo,
        corPrimaria,
        corFundo,
        imagemFundoUrl: imagemUrl,
        tipoSenha,
        senhaPadrao: tipoSenha === "padrao" ? senhaPadrao : "",
        mostrarInstalarApp: mostrarInstalar,
      });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
      {/* ===== Controles ===== */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Label>Template</Label>
            <div className="grid grid-cols-2 gap-3">
              {PORTAL_LOGIN_TEMPLATES.map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setTemplate(opcao)}
                  aria-pressed={template === opcao}
                  className={`flex flex-col gap-2 rounded-lg border-2 p-2 text-left text-sm transition-colors ${
                    template === opcao ? "border-primary" : "border-input hover:bg-muted"
                  }`}
                >
                  {/* Miniatura do template. */}
                  {opcao === "card" ? (
                    <span className="flex h-16 items-center justify-center rounded bg-zinc-800">
                      <span className="h-10 w-14 rounded bg-white" />
                    </span>
                  ) : (
                    <span className="flex h-16 overflow-hidden rounded">
                      <span className="w-1/2 bg-zinc-700" />
                      <span className="flex w-1/2 items-center justify-center bg-white">
                        <span className="h-6 w-8 rounded bg-zinc-200" />
                      </span>
                    </span>
                  )}
                  <span className="font-medium">{PORTAL_LOGIN_TEMPLATE_LABELS[opcao]}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pl-titulo">Título</Label>
              <Input id="pl-titulo" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pl-subtitulo">Subtítulo</Label>
              <Input id="pl-subtitulo" value={subtitulo} maxLength={200} onChange={(e) => setSubtitulo(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-6">
              <CampoCor id="pl-cor-primaria" rotulo="Cor primária" valor={corPrimaria} onChange={setCorPrimaria} />
              <CampoCor id="pl-cor-fundo" rotulo="Cor de fundo" valor={corFundo} onChange={setCorFundo} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{template === "split" ? "Imagem hero" : "Imagem de fundo"}</Label>
              <input ref={inputRef} type="file" accept={BANNER_TIPOS_ACEITOS.join(",")} onChange={handleArquivo} className="hidden" />
              <div className="flex items-center gap-3">
                {imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
                  <img src={imagemUrl} alt="Imagem escolhida" className="h-14 w-24 rounded-md border object-cover" />
                ) : (
                  <div className="text-muted-foreground flex h-14 w-24 items-center justify-center rounded-md border-2 border-dashed text-xs">Sem imagem</div>
                )}
                <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => inputRef.current?.click()}>
                  <Upload />
                  {enviando ? "Enviando..." : imagemUrl ? "Trocar" : "Enviar"}
                </Button>
                {imagemUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setImagemUrl("")}>
                    <Trash2 />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {template === "split"
                  ? "Ocupa a metade esquerda, com um véu da cor de fundo. Sem imagem, mostra o carrossel de banners do portal do aluno."
                  : "Fica atrás do cartão. Sem imagem, vale a cor de fundo."}{" "}
                JPG, PNG ou WebP, até 5MB.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <Label>Como o aluno entra</Label>
            {PORTAL_LOGIN_TIPOS_SENHA.map((opcao) => (
              <label
                key={opcao}
                className="has-[:checked]:border-primary flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm"
              >
                <input type="radio" name="pl-tipo-senha" className="mt-0.5" checked={tipoSenha === opcao} onChange={() => setTipoSenha(opcao)} />
                <span className="flex flex-col">
                  <span className="font-medium">{PORTAL_LOGIN_TIPO_SENHA_INFO[opcao].titulo}</span>
                  <span className="text-muted-foreground text-xs">{PORTAL_LOGIN_TIPO_SENHA_INFO[opcao].descricao}</span>
                </span>
              </label>
            ))}

            {tipoSenha === "padrao" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-senha-padrao">Senha padrão para novos alunos (opcional)</Label>
                <Input id="pl-senha-padrao" value={senhaPadrao} maxLength={72} autoComplete="off" onChange={(e) => setSenhaPadrao(e.target.value)} />
                <p className="text-muted-foreground text-xs">
                  Preenchida, TODO aluno novo entra com esta senha (e o formulário de cadastro deixa de pedir uma). Uma senha igual
                  para todos é frágil: ela vale até o aluno trocá-la. Mínimo de 8 caracteres.
                </p>
              </div>
            )}
            {tipoSenha === "aleatoria" && (
              <p className="text-muted-foreground text-xs">
                Depende do provedor de e-mail configurado e do template &quot;Dados de acesso&quot; ativo (Configurações &gt; E-mail).
              </p>
            )}
            {tipoSenha === "so_email" && (
              <p className="text-muted-foreground text-xs">
                Para o link funcionar em qualquer aparelho, o e-mail de &quot;Magic Link&quot; do Supabase (Authentication &gt; Email Templates)
                deve apontar para <code>{"{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/aluno"}</code>.
              </p>
            )}

            <label className="flex items-center justify-between gap-3 border-t pt-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Mostrar botão &quot;Instalar App&quot;</span>
                <span className="text-muted-foreground text-xs">Aparece só no celular, quando o aparelho permite instalar.</span>
              </span>
              <Switch checked={mostrarInstalar} onCheckedChange={setMostrarInstalar} />
            </label>
          </CardContent>
        </Card>

        {!criptografiaConfigurada && tipoSenha === "padrao" && senhaPadrao.trim() && (
          <p role="alert" className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">
            A variável de ambiente GATEWAYS_ENCRYPTION_KEY não está definida: não é possível salvar a senha padrão até configurá-la.
          </p>
        )}
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        {salvo && !erro && <p className="text-sm text-green-600 dark:text-green-400">Configurações salvas. A tela de login já está atualizada.</p>}

        <Button type="button" className="w-fit" onClick={handleSalvar} disabled={salvando || enviando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* ===== Preview em tempo real ===== */}
      <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs font-medium uppercase">Preview em tempo real</p>
          <div className="flex gap-1 rounded-md border p-0.5" role="group" aria-label="Tamanho do preview">
            <Button type="button" size="sm" variant={modo === "desktop" ? "secondary" : "ghost"} onClick={() => setModo("desktop")}>
              <Monitor />
              Computador
            </Button>
            <Button type="button" size="sm" variant={modo === "mobile" ? "secondary" : "ghost"} onClick={() => setModo("mobile")}>
              <Smartphone />
              Celular
            </Button>
          </div>
        </div>

        <div ref={colunaRef} className="w-full">
          <div
            className="mx-auto overflow-hidden rounded-lg border shadow-sm"
            style={{ width: moldura.largura * escala, height: moldura.altura * escala }}
          >
            {escala > 0 && (
              // portal-login-claro: a tela real é clara; o admin é escuro e reescreveria os tokens.
              <div
                className="portal-login-claro pointer-events-none origin-top-left select-none"
                style={{ width: moldura.largura, height: moldura.altura, transform: `scale(${escala})` }}
                aria-hidden
              >
                <PortalLoginLayout
                  modo={modo}
                  config={configPreview}
                  logoUrl={logoUrl}
                  nomeEscola={nomeEscola}
                  rodape={rodape}
                  formulario={<AlunoLoginFormPreview tipoSenha={tipoSenha} />}
                  instalarApp={
                    mostrarInstalar ? (
                      <Button type="button" variant="outline" size="sm" tabIndex={-1} className="w-full">
                        Instalar App
                      </Button>
                    ) : null
                  }
                />
              </div>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          É a mesma tela que o aluno vê em /entrar. O botão &quot;Instalar App&quot; real só aparece em aparelhos que permitem instalar.
        </p>
      </div>
    </div>
  );
}
