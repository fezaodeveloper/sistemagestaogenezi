"use client";

// "use client": botão flutuante + balão com busca, estado aberto/fechado,
// listeners de clique-fora/Escape e área de transferência.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, Copy, Eye, EyeOff, Monitor, Search, X } from "lucide-react";
import {
  getSenhaAcessoRemoto,
  listarAcessosRemotosParaBalao,
  type AcessoRemotoResumo,
} from "@/app/admin/acesso-remoto/actions";
import { normalizarBusca } from "@/lib/busca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CampoCopiado = "login" | "senha";

// Botão flutuante discreto (canto inferior direito, só no painel admin) que
// abre um balão pequeno — NÃO modal, não bloqueia a tela — pra achar um PC de
// acesso remoto durante a aula e copiar login/senha. Usa os mesmos dados de
// /admin/acesso-remoto (tabela acesso_remoto), sem alterar nada dela.
//
// Segurança: a lista traz só id/nome/login. A SENHA não vai junto: é buscada
// sob demanda ao selecionar um PC e descartada da memória ao fechar o balão.
export function BalaoAcessoRemoto() {
  const [aberto, setAberto] = useState(false);
  const [pcs, setPcs] = useState<AcessoRemotoResumo[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<AcessoRemotoResumo | null>(null);
  const [senha, setSenha] = useState<string | null>(null);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<CampoCopiado | null>(null);
  const [carregandoLista, startLista] = useTransition();
  const [carregandoSenha, startSenha] = useTransition();

  const painelRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  // Descarta resposta atrasada de uma seleção anterior.
  const selecaoAtualRef = useRef<string | null>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    setBusca("");
    setSelecionado(null);
    // A senha não fica na memória do componente depois de fechar.
    setSenha(null);
    setSenhaVisivel(false);
    setErroSenha(null);
    setCopiado(null);
    selecaoAtualRef.current = null;
  }, []);

  // Fecha ao clicar/tocar fora do balão (o próprio botão não conta como "fora":
  // ele faz o toggle) e com Escape.
  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(event: MouseEvent | TouchEvent) {
      const alvo = event.target as Node;
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      fechar();
    }
    function aoTeclar(event: KeyboardEvent) {
      if (event.key === "Escape") {
        fechar();
        botaoRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("touchstart", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("touchstart", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, fechar]);

  function alternar() {
    if (aberto) {
      fechar();
      return;
    }
    setAberto(true);
    // Recarrega a lista a cada abertura (um PC novo/desativado aparece na hora).
    setErroLista(null);
    startLista(async () => {
      try {
        setPcs(await listarAcessosRemotosParaBalao());
      } catch {
        setErroLista("Não foi possível carregar os PCs.");
      }
    });
  }

  function selecionar(pc: AcessoRemotoResumo) {
    setSelecionado(pc);
    setSenha(null);
    setSenhaVisivel(false);
    setErroSenha(null);
    selecaoAtualRef.current = pc.id;
    startSenha(async () => {
      const resultado = await getSenhaAcessoRemoto(pc.id);
      if (selecaoAtualRef.current !== pc.id) return;
      if ("error" in resultado) setErroSenha(resultado.error);
      else setSenha(resultado.senha);
    });
  }

  function voltarParaLista() {
    setSelecionado(null);
    setSenha(null);
    setSenhaVisivel(false);
    setErroSenha(null);
    selecaoAtualRef.current = null;
  }

  async function copiar(texto: string, campo: CampoCopiado) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(campo);
      setTimeout(() => setCopiado((atual) => (atual === campo ? null : atual)), 1500);
    } catch {
      // Clipboard indisponível (HTTP sem TLS, permissão negada) — o valor
      // continua visível pra copiar na mão (a senha, ao revelar).
    }
  }

  const termo = normalizarBusca(busca);
  const filtrados = (pcs ?? []).filter((pc) => !termo || normalizarBusca(pc.nome_pc).includes(termo));

  return (
    <>
      <Button
        ref={botaoRef}
        type="button"
        variant="outline"
        size="icon"
        onClick={alternar}
        aria-label="Acesso remoto aos PCs"
        aria-expanded={aberto}
        title="Acesso remoto"
        className={`bg-background fixed right-4 bottom-4 z-50 size-9 rounded-full shadow-md transition-opacity print:hidden ${
          aberto ? "opacity-100" : "opacity-50 hover:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <Monitor className="size-4" />
      </Button>

      {aberto && (
        <div
          ref={painelRef}
          role="dialog"
          aria-label="Acesso remoto"
          className="bg-popover text-popover-foreground ring-foreground/10 fixed right-4 bottom-16 z-50 flex max-h-[70vh] w-[min(320px,calc(100vw-2rem))] flex-col gap-2 rounded-lg p-3 text-sm shadow-lg ring-1 print:hidden"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {selecionado && (
                <button
                  type="button"
                  onClick={voltarParaLista}
                  aria-label="Voltar para a lista"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <span className="font-medium">Acesso remoto</span>
            </div>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {!selecionado ? (
            <>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                <Input
                  autoFocus
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar PC pelo nome..."
                  aria-label="Buscar PC pelo nome"
                  autoComplete="off"
                  className="h-8 pl-7 text-sm"
                />
              </div>

              <div className="flex min-h-0 flex-col overflow-y-auto">
                {erroLista ? (
                  <p role="alert" className="text-destructive py-3 text-center text-xs">
                    {erroLista}
                  </p>
                ) : pcs === null || (carregandoLista && pcs.length === 0) ? (
                  <p className="text-muted-foreground py-3 text-center text-xs">Carregando...</p>
                ) : pcs.length === 0 ? (
                  <p className="text-muted-foreground py-3 text-center text-xs">Nenhum PC ativo cadastrado.</p>
                ) : filtrados.length === 0 ? (
                  <p className="text-muted-foreground py-3 text-center text-xs">Nenhum PC encontrado.</p>
                ) : (
                  filtrados.map((pc) => (
                    <button
                      key={pc.id}
                      type="button"
                      onClick={() => selecionar(pc)}
                      className="hover:bg-muted flex flex-col rounded-md px-2 py-1.5 text-left"
                    >
                      <span className="truncate font-medium">{pc.nome_pc}</span>
                      <span className="text-muted-foreground truncate text-xs">{pc.login}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-muted-foreground text-xs">PC</p>
                <p className="font-medium break-words">{selecionado.nome_pc}</p>
              </div>

              <div>
                <p className="text-muted-foreground text-xs">Login</p>
                <div className="flex items-center gap-1.5">
                  <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">{selecionado.login}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => copiar(selecionado.login, "login")}
                    aria-label="Copiar login"
                    title="Copiar login"
                  >
                    {copiado === "login" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs">Senha</p>
                {erroSenha ? (
                  <p role="alert" className="text-destructive text-xs">
                    {erroSenha}
                  </p>
                ) : senha === null || carregandoSenha ? (
                  <p className="text-muted-foreground text-xs">Carregando...</p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                      {senhaVisivel ? senha : "••••••••••"}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setSenhaVisivel((v) => !v)}
                      aria-label={senhaVisivel ? "Ocultar senha" : "Revelar senha"}
                      title={senhaVisivel ? "Ocultar senha" : "Revelar senha"}
                    >
                      {senhaVisivel ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => copiar(senha, "senha")}
                      aria-label="Copiar senha"
                      title="Copiar senha"
                    >
                      {copiado === "senha" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
