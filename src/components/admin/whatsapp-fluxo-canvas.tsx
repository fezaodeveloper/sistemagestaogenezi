"use client";

// "use client": canvas interativo (arrastar nó, zoom, seleção, painel lateral) — não usa
// biblioteca de drag-and-drop externa, só pointer events + CSS transform (pedido da tarefa).
//
// Conexões entre nós são definidas pelo PAINEL LATERAL (selects "próximo nó" / "se sim" / "se
// não"), não arrastando uma linha de um nó a outro — arrastar-para-conectar com precisão exige
// bem mais lógica (detecção de proximidade, cancelamento, ...) do que um select confiável; as
// linhas SVG continuam desenhadas automaticamente a partir do que o painel define, então o
// resultado visual ("canvas com conexões") é o mesmo, só o MÉTODO de ligar dois nós é mais
// simples/robusto sem lib externa.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus as PlusIcon, Send, Trash2 } from "lucide-react";
import { salvarNosFluxo, testarFluxo } from "@/app/admin/whatsapp-fluxos/actions";
import {
  CONDICAO_OPERADORES,
  CONDICAO_OPERADOR_LABELS,
  DELAY_UNIDADES,
  FLUXO_GATILHO_LABELS,
  FLUXO_GATILHO_VARIAVEIS,
  TIPO_NO_INFO,
  novoId,
  type CondicaoOperador,
  type FluxoGatilho,
  type NoFluxo,
  type TipoNo,
} from "@/lib/whatsapp/fluxos-tipos";
import { SmsCampoMensagem } from "@/components/admin/sms-campo-mensagem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LARGURA_NO = 220;
const ALTURA_NO = 92;
const TELA_LARGURA = 1800;
const TELA_ALTURA = 1100;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;

const TIPOS_ADICIONAVEIS: TipoNo[] = ["mensagem", "aguardar", "condicao", "fim"];

function previewNo(no: NoFluxo, gatilho: FluxoGatilho): string {
  switch (no.tipo) {
    case "gatilho":
      return FLUXO_GATILHO_LABELS[gatilho];
    case "mensagem":
      return no.dados.texto?.trim() || "(sem texto)";
    case "aguardar": {
      const segundos = Number(no.dados.segundos) || 0;
      const unidade = [...DELAY_UNIDADES].reverse().find((u) => segundos % u.segundos === 0 && segundos / u.segundos >= 1) ?? DELAY_UNIDADES[0];
      return `${segundos / unidade.segundos} ${unidade.label}`;
    }
    case "condicao":
      return no.dados.campo ? `{${no.dados.campo}} ${CONDICAO_OPERADOR_LABELS[no.dados.operador ?? "igual"]} ${no.dados.valor ?? ""}` : "(configure a condição)";
    case "fim":
      return "Encerra o fluxo";
  }
}

function labelNo(no: NoFluxo, indice: number): string {
  return `${TIPO_NO_INFO[no.tipo].emoji} ${TIPO_NO_INFO[no.tipo].label} (${indice + 1})`;
}

// Ponto de saída (base) e entrada (topo) de um nó, em coordenadas do canvas — usados tanto pras
// linhas SVG quanto pro cálculo de arraste.
function saida(no: NoFluxo) {
  return { x: no.posicao.x + LARGURA_NO / 2, y: no.posicao.y + ALTURA_NO };
}
function entrada(no: NoFluxo) {
  return { x: no.posicao.x + LARGURA_NO / 2, y: no.posicao.y };
}

function curva(de: { x: number; y: number }, para: { x: number; y: number }): string {
  const meio = (de.y + para.y) / 2;
  return `M ${de.x},${de.y} C ${de.x},${meio} ${para.x},${meio} ${para.x},${para.y}`;
}

export function WhatsappFluxoCanvas({
  fluxoId,
  gatilho,
  nomeInicial,
  descricaoInicial,
  nosIniciais,
}: {
  fluxoId: string;
  gatilho: FluxoGatilho;
  nomeInicial: string;
  descricaoInicial: string;
  nosIniciais: NoFluxo[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [nos, setNos] = useState<NoFluxo[]>(nosIniciais);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const [paraExcluir, setParaExcluir] = useState<string | null>(null);

  const [testeAberto, setTesteAberto] = useState(false);
  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; erro?: string } | null>(null);
  const [testando, startTeste] = useTransition();

  const arrastandoRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const selecionado = nos.find((n) => n.id === selecionadoId) ?? null;
  const variaveisDoGatilho = FLUXO_GATILHO_VARIAVEIS[gatilho];
  const placeholdersDoGatilho = variaveisDoGatilho.map((v) => ({ chave: v, descricao: `Variável de "${FLUXO_GATILHO_LABELS[gatilho]}"`, exemplo: v }));

  function atualizarNo(id: string, parcial: Partial<NoFluxo>) {
    setOk(false);
    setNos((atual) => atual.map((n) => (n.id === id ? ({ ...n, ...parcial } as NoFluxo) : n)));
  }
  function atualizarDados(id: string, dados: NoFluxo["dados"]) {
    atualizarNo(id, { dados });
  }

  function adicionarNo(tipo: TipoNo) {
    const id = novoId(nos);
    const base = selecionado ? { x: selecionado.posicao.x + 260, y: selecionado.posicao.y } : { x: 60, y: 60 + nos.length * 30 };
    const dadosPadrao: NoFluxo["dados"] =
      tipo === "mensagem" ? { texto: "" } : tipo === "aguardar" ? { segundos: 3600 } : tipo === "condicao" ? { campo: "", operador: "igual", valor: "" } : {};
    const novo: NoFluxo = { id, tipo, posicao: base, dados: dadosPadrao, proximos: [] };
    setNos((atual) => [...atual, novo]);
    setSelecionadoId(id);
    setOk(false);
  }

  function excluirNo(id: string) {
    setNos((atual) =>
      atual.filter((n) => n.id !== id).map((n) => ({ ...n, proximos: n.proximos.filter((p) => p !== id) })),
    );
    if (selecionadoId === id) setSelecionadoId(null);
    setParaExcluir(null);
    setOk(false);
  }

  // Arraste: pointer events na "alça" do nó (o próprio card) + listeners globais enquanto dura.
  function iniciarArraste(e: React.PointerEvent, no: NoFluxo) {
    if ((e.target as HTMLElement).closest("[data-sem-arraste]")) return;
    e.preventDefault();
    setSelecionadoId(no.id);
    arrastandoRef.current = { id: no.id, startX: e.clientX, startY: e.clientY, origX: no.posicao.x, origY: no.posicao.y };
  }

  useEffect(() => {
    function mover(e: PointerEvent) {
      const arr = arrastandoRef.current;
      if (!arr) return;
      const dx = (e.clientX - arr.startX) / zoom;
      const dy = (e.clientY - arr.startY) / zoom;
      const x = Math.max(0, Math.min(TELA_LARGURA - LARGURA_NO, arr.origX + dx));
      const y = Math.max(0, Math.min(TELA_ALTURA - ALTURA_NO, arr.origY + dy));
      setNos((atual) => atual.map((n) => (n.id === arr.id ? { ...n, posicao: { x, y } } : n)));
    }
    function soltar() {
      arrastandoRef.current = null;
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
  }, [zoom]);

  function salvar() {
    setErro(null);
    setOk(false);
    startSalvar(async () => {
      const r = await salvarNosFluxo(fluxoId, { nome, descricao }, nos);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  function testar() {
    setResultadoTeste(null);
    startTeste(async () => {
      const r = await testarFluxo(fluxoId, telefoneTeste);
      if ("error" in r) {
        setResultadoTeste({ ok: false, erro: r.error });
        return;
      }
      setResultadoTeste({ ok: true });
    });
  }

  const outrosNos = (id: string) => nos.filter((n) => n.id !== id && n.tipo !== "gatilho");
  const itensDestino = (id: string): Record<string, string> =>
    Object.fromEntries([["", "— nenhum (encerra aqui) —"], ...outrosNos(id).map((n) => [n.id, labelNo(n, nos.indexOf(n))])]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="fluxo-nome-editor">Nome</Label>
          <Input id="fluxo-nome-editor" value={nome} maxLength={100} onChange={(e) => { setNome(e.target.value); setOk(false); }} disabled={salvando} />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="fluxo-descricao-editor">Descrição</Label>
          <Input id="fluxo-descricao-editor" value={descricao} maxLength={500} onChange={(e) => { setDescricao(e.target.value); setOk(false); }} disabled={salvando} />
        </div>
        <Badge variant="outline">{FLUXO_GATILHO_LABELS[gatilho]}</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="sm"><PlusIcon />Adicionar nó</Button>} />
            <DropdownMenuContent>
              {TIPOS_ADICIONAVEIS.map((tipo) => (
                <DropdownMenuItem key={tipo} onClick={() => adicionarNo(tipo)}>
                  {TIPO_NO_INFO[tipo].emoji} {TIPO_NO_INFO[tipo].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" size="icon-sm" variant="outline" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - 0.1) * 10) / 10))}>
            <Minus />
          </Button>
          <span className="text-muted-foreground w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="icon-sm" variant="outline" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + 0.1) * 10) / 10))}>
            <PlusIcon />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setTesteAberto(true)}>
            <Send />
            Testar fluxo
          </Button>
          <Button type="button" size="sm" disabled={salvando || !nome.trim()} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar fluxo"}
          </Button>
          {ok && <span role="status" className="text-sm text-green-600 dark:text-green-400">Salvo.</span>}
        </div>
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        {/* ===== Canvas ===== */}
        <div className="bg-muted/20 relative h-[34rem] overflow-auto rounded-lg border">
          <div
            className="relative"
            style={{ width: TELA_LARGURA * zoom, height: TELA_ALTURA * zoom }}
          >
            <div style={{ width: TELA_LARGURA, height: TELA_ALTURA, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="relative">
              <svg width={TELA_LARGURA} height={TELA_ALTURA} className="pointer-events-none absolute inset-0">
                {nos.map((no) =>
                  no.proximos.map((destinoId, indice) => {
                    const destino = nos.find((n) => n.id === destinoId);
                    if (!destino) return null;
                    const cor = no.tipo === "condicao" ? (indice === 0 ? "#22c55e" : "#ef4444") : "#94a3b8";
                    return (
                      <path
                        key={`${no.id}-${destinoId}-${indice}`}
                        d={curva(saida(no), entrada(destino))}
                        fill="none"
                        stroke={cor}
                        strokeWidth={2}
                        markerEnd="url(#seta-fluxo)"
                      />
                    );
                  }),
                )}
                <defs>
                  <marker id="seta-fluxo" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>

              {nos.map((no, indice) => {
                const info = TIPO_NO_INFO[no.tipo];
                return (
                  <div
                    key={no.id}
                    onPointerDown={(e) => iniciarArraste(e, no)}
                    className={`absolute flex cursor-grab flex-col gap-1 rounded-lg border-2 bg-card p-2.5 shadow-sm select-none active:cursor-grabbing ${
                      selecionadoId === no.id ? "ring-primary ring-2" : ""
                    }`}
                    style={{ left: no.posicao.x, top: no.posicao.y, width: LARGURA_NO, height: ALTURA_NO, borderColor: info.cor }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold" style={{ color: info.cor }}>
                        {info.emoji} {info.label}
                      </span>
                      {no.tipo !== "gatilho" && (
                        <button
                          type="button"
                          data-sem-arraste
                          aria-label={`Excluir ${labelNo(no, indice)}`}
                          onClick={() => setParaExcluir(no.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-[0.7rem] break-words">{previewNo(no, gatilho)}</p>
                    {/* Pontos de conexão (decorativos). */}
                    {no.tipo !== "gatilho" && <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border bg-background" />}
                    {no.tipo !== "fim" && <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rounded-full border bg-background" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== Painel lateral ===== */}
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          {!selecionado ? (
            <p className="text-muted-foreground text-sm">Clique num nó pra editar. Arraste pelo card pra reposicionar.</p>
          ) : (
            <PainelNo
              key={selecionado.id}
              no={selecionado}
              gatilho={gatilho}
              placeholders={placeholdersDoGatilho}
              itensDestino={itensDestino(selecionado.id)}
              onDadosChange={(dados) => atualizarDados(selecionado.id, dados)}
              onProximosChange={(proximos) => atualizarNo(selecionado.id, { proximos })}
            />
          )}
        </div>
      </div>

      <AlertDialog open={paraExcluir !== null} onOpenChange={(v) => !v && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nó</AlertDialogTitle>
            <AlertDialogDescription>Outros nós que apontavam pra ele deixam de ter esse destino (ficam &quot;sem próximo&quot;).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => paraExcluir && excluirNo(paraExcluir)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={testeAberto} onOpenChange={(v) => { if (!testando) { setTesteAberto(v); if (!v) setResultadoTeste(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Testar fluxo</AlertDialogTitle>
            <AlertDialogDescription>
              Executa o fluxo SALVO (salve antes de testar alterações) para o telefone informado, com dados de exemplo no lugar dos
              placeholders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fluxo-teste-telefone">Telefone (com DDD)</Label>
            <Input id="fluxo-teste-telefone" value={telefoneTeste} onChange={(e) => setTelefoneTeste(e.target.value)} placeholder="11999999999" disabled={testando} />
            {resultadoTeste?.ok && <span role="status" className="text-sm text-green-600 dark:text-green-400">Fluxo iniciado — acompanhe na aba Execuções.</span>}
            {resultadoTeste && !resultadoTeste.ok && <span role="alert" className="text-destructive text-sm">{resultadoTeste.erro}</span>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={testando}>Fechar</AlertDialogCancel>
            <AlertDialogAction disabled={testando || !telefoneTeste.trim()} onClick={testar}>
              {testando ? "Enviando..." : "Executar teste"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PainelNo({
  no,
  gatilho,
  placeholders,
  itensDestino,
  onDadosChange,
  onProximosChange,
}: {
  no: NoFluxo;
  gatilho: FluxoGatilho;
  placeholders: { chave: string; descricao: string; exemplo: string }[];
  itensDestino: Record<string, string>;
  onDadosChange: (dados: NoFluxo["dados"]) => void;
  onProximosChange: (proximos: string[]) => void;
}) {
  const opcoes = Object.entries(itensDestino);

  if (no.tipo === "gatilho") {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">🎯 Gatilho</h3>
        <p className="text-muted-foreground text-sm">
          Este fluxo começa quando: <strong>{FLUXO_GATILHO_LABELS[gatilho]}</strong>.
        </p>
        <p className="text-muted-foreground text-xs">O gatilho não é editável aqui — crie um novo fluxo para usar outro evento.</p>
      </div>
    );
  }

  if (no.tipo === "fim") {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">🏁 Fim</h3>
        <p className="text-muted-foreground text-sm">Encerra a execução do fluxo aqui (marca como concluído).</p>
      </div>
    );
  }

  if (no.tipo === "mensagem") {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">💬 Mensagem</h3>
        <SmsCampoMensagem
          id={`no-msg-${no.id}`}
          rotulo="Texto"
          valor={no.dados.texto ?? ""}
          onChange={(v) => onDadosChange({ texto: v })}
          placeholders={placeholders}
          limite={1000}
          linhas={5}
        />
        <SeletorProximo label="Próximo nó" valor={no.proximos[0] ?? ""} opcoes={opcoes} onChange={(v) => onProximosChange(v ? [v] : [])} />
      </div>
    );
  }

  if (no.tipo === "aguardar") {
    const segundos = Number(no.dados.segundos) || 60;
    const unidade = [...DELAY_UNIDADES].reverse().find((u) => segundos % u.segundos === 0 && segundos / u.segundos >= 1) ?? DELAY_UNIDADES[0];
    const valor = segundos / unidade.segundos;
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">⏳ Aguardar</h3>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={valor}
            onChange={(e) => onDadosChange({ segundos: Math.max(1, Number(e.target.value) || 1) * unidade.segundos })}
            className="w-24"
          />
          <Select
            items={Object.fromEntries(DELAY_UNIDADES.map((u) => [u.chave, u.label]))}
            value={unidade.chave}
            onValueChange={(v) => {
              const nova = DELAY_UNIDADES.find((u) => u.chave === v);
              if (nova) onDadosChange({ segundos: valor * nova.segundos });
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELAY_UNIDADES.map((u) => (
                <SelectItem key={u.chave} value={u.chave}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs">
          O sistema retoma este fluxo pelo menos 1x por dia (crons da Vercel) — uma espera de minutos/horas costuma só ser
          retomada na próxima passagem diária, não com precisão de minuto.
        </p>
        <SeletorProximo label="Depois da espera, vai para" valor={no.proximos[0] ?? ""} opcoes={opcoes} onChange={(v) => onProximosChange(v ? [v] : [])} />
      </div>
    );
  }

  // condicao
  const mostrarValor = no.dados.operador !== "vazio" && no.dados.operador !== "nao_vazio";
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">❓ Condição</h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`no-campo-${no.id}`}>Variável</Label>
        <Input
          id={`no-campo-${no.id}`}
          value={no.dados.campo ?? ""}
          onChange={(e) => onDadosChange({ ...no.dados, campo: e.target.value })}
          placeholder="ex.: nome, curso, valor..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Operador</Label>
        <Select
          items={Object.fromEntries(CONDICAO_OPERADORES.map((o) => [o, CONDICAO_OPERADOR_LABELS[o]]))}
          value={no.dados.operador ?? "igual"}
          onValueChange={(v) => v && onDadosChange({ ...no.dados, operador: v as CondicaoOperador })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDICAO_OPERADORES.map((o) => (
              <SelectItem key={o} value={o}>
                {CONDICAO_OPERADOR_LABELS[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mostrarValor && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`no-valor-${no.id}`}>Valor de comparação</Label>
          <Input id={`no-valor-${no.id}`} value={no.dados.valor ?? ""} onChange={(e) => onDadosChange({ ...no.dados, valor: e.target.value })} />
        </div>
      )}
      <SeletorProximo
        label="Se SIM, vai para"
        valor={no.proximos[0] ?? ""}
        opcoes={opcoes}
        onChange={(v) => onProximosChange([v, no.proximos[1] ?? ""].filter((x, i) => i === 0 || x))}
      />
      <SeletorProximo
        label="Se NÃO, vai para"
        valor={no.proximos[1] ?? ""}
        opcoes={opcoes}
        onChange={(v) => onProximosChange([no.proximos[0] ?? "", v])}
      />
    </div>
  );
}

function SeletorProximo({
  label,
  valor,
  opcoes,
  onChange,
}: {
  label: string;
  valor: string;
  opcoes: [string, string][];
  onChange: (valor: string) => void;
}) {
  const items = Object.fromEntries(opcoes);
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select items={items} value={valor} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map(([id, texto]) => (
            <SelectItem key={id || "none"} value={id}>
              {texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
