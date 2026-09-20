"use client";

// "use client": drag-and-drop (eventos nativos do navegador), edição inline
// do nome da coluna, atualização otimista e dialogs.

import { useMemo, useOptimistic, useRef, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  criarKanbanColuna,
  excluirKanbanColuna,
  moverLeadKanban,
  renomearKanbanColuna,
} from "@/app/admin/leads/actions";
import {
  KANBAN_COLUNAS_ENCERRADAS,
  KANBAN_COLUNAS_PROTEGIDAS,
  TEMPERATURAS,
  TEMPERATURA_BADGE_CLASS,
  TEMPERATURA_LABELS,
  campanhaBadgeClass,
  contarFollowups,
  formatarDataHoraLead,
  formatarDataLead,
  kanbanColunaEstilo,
  type KanbanColunaConfig,
} from "@/lib/leads/schema";
import type { LeadComCurso } from "@/lib/leads/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { CopiarWhatsappButton } from "@/components/admin/copiar-whatsapp-button";
import { LeadDetalhesDrawer } from "@/components/admin/lead-detalhes-drawer";

const FILTRO_TODOS = "__todos__";
const TEMPERATURA_FILTRO_ITEMS: Record<string, string> = { [FILTRO_TODOS]: "Todas", ...TEMPERATURA_LABELS };
const COR_NOVA_COLUNA_PADRAO = "#6366f1";

function formatarDataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

function diasDesdeCadastro(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function LeadCard({
  lead,
  colunas,
  arrastando,
  onMover,
  onMudou,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadComCurso;
  colunas: KanbanColunaConfig[];
  arrastando: boolean;
  onMover: (colunaId: string) => void;
  onMudou: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const [drawerAberto, setDrawerAberto] = useState(false);
  const proximaAcaoFormatada = formatarDataCurta(lead.proxima_acao);
  const vencida =
    !!lead.proxima_acao && lead.proxima_acao < hojeISO() && !KANBAN_COLUNAS_ENCERRADAS.includes(lead.kanban_coluna);
  const whatsappDigitos = lead.telefone.replace(/\D/g, "");
  const followups = contarFollowups(lead.notas);
  const colunaItems = Object.fromEntries(colunas.map((c) => [c.id, c.nome]));

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`cursor-grab active:cursor-grabbing ${arrastando ? "opacity-40" : ""}`}
      >
        <Card className={vencida ? "border-amber-500/60 bg-amber-500/5" : undefined}>
          <CardContent className="flex flex-col gap-2 p-3">
            <p className="text-sm font-medium">{lead.nome}</p>
            <div className="-my-1 flex items-center gap-1">
              <a
                href={`https://wa.me/55${whatsappDigitos}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="text-muted-foreground hover:text-foreground w-fit text-xs hover:underline"
              >
                📱 {lead.telefone}
              </a>
              <CopiarWhatsappButton telefone={lead.telefone} />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {lead.temperatura && (
                <Badge className={TEMPERATURA_BADGE_CLASS[lead.temperatura]}>
                  {TEMPERATURA_LABELS[lead.temperatura]}
                </Badge>
              )}
              {lead.campanha_origem && (
                <Badge
                  className={`max-w-full ${campanhaBadgeClass(lead.campanha_origem)}`}
                  title={`Campanha: ${lead.campanha_origem}`}
                >
                  <span className="truncate">📣 {lead.campanha_origem}</span>
                </Badge>
              )}
              {proximaAcaoFormatada && (
                <Badge
                  variant="outline"
                  className={vencida ? "border-amber-500 text-amber-700 dark:text-amber-400" : undefined}
                >
                  📅 {proximaAcaoFormatada}
                </Badge>
              )}
            </div>

            <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
              <p>
                🗓️ Cadastrado em {formatarDataHoraLead(lead.created_at)} ({diasDesdeCadastro(lead.created_at)} dia(s))
              </p>
              {lead.ultimo_followup && <p>📞 Último contato: {formatarDataLead(lead.ultimo_followup)}</p>}
              <p>
                🔁 {followups} follow-up{followups === 1 ? "" : "s"} realizado{followups === 1 ? "" : "s"}
              </p>
            </div>

            <Button type="button" size="sm" variant="outline" onClick={() => setDrawerAberto(true)}>
              Ver detalhes
            </Button>

            {/* Alternativa ao arrastar — HTML5 drag-and-drop não funciona em
                celular/tablet, e assim o quadro também é operável por teclado. */}
            <Select items={colunaItems} value={lead.kanban_coluna} onValueChange={(valor) => valor && onMover(valor)}>
              <SelectTrigger className="h-8 text-xs" aria-label="Mover para">
                <SelectValue placeholder="Mover para..." />
              </SelectTrigger>
              <SelectContent>
                {colunas.map((coluna) => (
                  <SelectItem key={coluna.id} value={coluna.id}>
                    {coluna.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <LeadDetalhesDrawer
        lead={lead}
        colunas={colunas}
        open={drawerAberto}
        onOpenChange={setDrawerAberto}
        onMudou={onMudou}
      />
    </>
  );
}

export function LeadsKanbanView({
  leads,
  colunas,
  campanhas,
}: {
  leads: LeadComCurso[];
  colunas: KanbanColunaConfig[];
  campanhas: string[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [colunaSobre, setColunaSobre] = useState<string | null>(null);
  const [filtroTemperatura, setFiltroTemperatura] = useState(FILTRO_TODOS);
  const [filtroCampanha, setFiltroCampanha] = useState(FILTRO_TODOS);
  const [isPending, startTransition] = useTransition();

  // Edição inline do nome (clique duplo no título ou "Renomear" no menu).
  const [edicao, setEdicao] = useState<{ id: string; nome: string } | null>(null);
  // Enter e blur disparam em sequência ao confirmar — a flag garante que a
  // edição só é finalizada (e salva) uma vez.
  const finalizandoRef = useRef(false);

  const [apagando, setApagando] = useState<KanbanColunaConfig | null>(null);

  const [novaAberta, setNovaAberta] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(COR_NOVA_COLUNA_PADRAO);
  const [erroNova, setErroNova] = useState<string | null>(null);

  // Atualização otimista: o card muda de coluna (e o título renomeia) na
  // hora, sem esperar a Server Action. Se ela falhar, o React descarta o
  // estado otimista ao fim da transição e tudo volta ao que estava.
  const [leadsVisiveis, aplicarMovimento] = useOptimistic(
    leads,
    (atuais, movimento: { leadId: string; colunaId: string }) =>
      atuais.map((l) => (l.id === movimento.leadId ? { ...l, kanban_coluna: movimento.colunaId } : l)),
  );
  const [colunasVisiveis, aplicarRenomeacao] = useOptimistic(
    colunas,
    (atuais, mudanca: { id: string; nome: string }) =>
      atuais.map((c) => (c.id === mudanca.id ? { ...c, nome: mudanca.nome } : c)),
  );

  const campanhaItems: Record<string, string> = useMemo(
    () => ({ [FILTRO_TODOS]: "Todas as campanhas", ...Object.fromEntries(campanhas.map((c) => [c, c])) }),
    [campanhas],
  );

  const leadsFiltrados = useMemo(
    () =>
      leadsVisiveis.filter(
        (lead) =>
          (filtroTemperatura === FILTRO_TODOS || lead.temperatura === filtroTemperatura) &&
          (filtroCampanha === FILTRO_TODOS || lead.campanha_origem === filtroCampanha),
      ),
    [leadsVisiveis, filtroTemperatura, filtroCampanha],
  );

  const porColuna = useMemo(() => {
    const grupos = new Map<string, LeadComCurso[]>(colunasVisiveis.map((c) => [c.id, []]));
    for (const lead of leadsFiltrados) grupos.get(lead.kanban_coluna)?.push(lead);
    return grupos;
  }, [colunasVisiveis, leadsFiltrados]);

  function handleMudou() {
    router.refresh();
  }

  // Arrastar (ou usar o select do card) grava kanban_coluna no banco via
  // moverLeadKanban. Se o banco recusar, mostra o erro e o card volta.
  function mover(lead: LeadComCurso, colunaId: string) {
    if (lead.kanban_coluna === colunaId) return;
    setErro(null);
    startTransition(async () => {
      aplicarMovimento({ leadId: lead.id, colunaId });
      const resultado = await moverLeadKanban(lead.id, colunaId);
      if (resultado.error) setErro(resultado.error);
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, colunaId: string) {
    event.preventDefault();
    setColunaSobre(null);
    const id = event.dataTransfer.getData("text/plain") || arrastandoId;
    setArrastandoId(null);
    const lead = leadsVisiveis.find((l) => l.id === id);
    if (lead) mover(lead, colunaId);
  }

  function iniciarEdicao(coluna: KanbanColunaConfig) {
    finalizandoRef.current = false;
    setEdicao({ id: coluna.id, nome: coluna.nome });
  }

  function finalizarEdicao(salvar: boolean) {
    if (finalizandoRef.current || !edicao) return;
    finalizandoRef.current = true;
    const { id, nome } = edicao;
    const nomeFinal = nome.trim();
    setEdicao(null);

    const original = colunasVisiveis.find((c) => c.id === id);
    if (!salvar || !nomeFinal || nomeFinal === original?.nome) return;

    setErro(null);
    startTransition(async () => {
      aplicarRenomeacao({ id, nome: nomeFinal });
      const resultado = await renomearKanbanColuna(id, nomeFinal);
      if (resultado.error) setErro(resultado.error);
    });
  }

  function pedirExclusao(coluna: KanbanColunaConfig) {
    setErro(null);
    const total = leads.filter((l) => l.kanban_coluna === coluna.id).length;
    if (total > 0) {
      setErro(`Só é possível apagar colunas vazias. Mova os ${total} lead(s) de "${coluna.nome}" antes.`);
      return;
    }
    setApagando(coluna);
  }

  function confirmarExclusao() {
    if (!apagando) return;
    const alvo = apagando;
    startTransition(async () => {
      const resultado = await excluirKanbanColuna(alvo.id);
      setApagando(null);
      if (resultado.error) setErro(resultado.error);
    });
  }

  function abrirNovaColuna() {
    setNovoNome("");
    setNovaCor(COR_NOVA_COLUNA_PADRAO);
    setErroNova(null);
    setNovaAberta(true);
  }

  function confirmarNovaColuna() {
    setErroNova(null);
    startTransition(async () => {
      const resultado = await criarKanbanColuna(novoNome, novaCor);
      if (resultado.error) {
        setErroNova(resultado.error);
        return;
      }
      setNovaAberta(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Temperatura</span>
          <Select
            items={TEMPERATURA_FILTRO_ITEMS}
            value={filtroTemperatura}
            onValueChange={(valor) => valor && setFiltroTemperatura(valor)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[FILTRO_TODOS, ...TEMPERATURAS].map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {TEMPERATURA_FILTRO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Campanha</span>
          <Select
            items={campanhaItems}
            value={filtroCampanha}
            onValueChange={(valor) => valor && setFiltroCampanha(valor)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(campanhaItems).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {campanhaItems[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {colunasVisiveis.map((coluna) => {
          const cards = porColuna.get(coluna.id) ?? [];
          const protegida = KANBAN_COLUNAS_PROTEGIDAS.includes(coluna.id);
          const editando = edicao?.id === coluna.id;

          return (
            <div
              key={coluna.id}
              onDragOver={(event) => {
                event.preventDefault(); // sem isso o navegador não aceita o drop
                event.dataTransfer.dropEffect = "move";
                setColunaSobre(coluna.id);
              }}
              onDragLeave={(event) => {
                // dragleave também dispara ao entrar num filho — só limpa
                // quando o cursor realmente saiu da coluna.
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setColunaSobre(null);
              }}
              onDrop={(event) => handleDrop(event, coluna.id)}
              className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg p-1 transition-colors ${
                colunaSobre === coluna.id ? "bg-muted ring-primary/40 ring-2" : ""
              }`}
            >
              <div
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
                style={kanbanColunaEstilo(coluna.cor)}
              >
                {editando ? (
                  <Input
                    autoFocus
                    value={edicao.nome}
                    maxLength={40}
                    onChange={(event) => setEdicao({ id: coluna.id, nome: event.target.value })}
                    onBlur={() => finalizarEdicao(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") finalizarEdicao(true);
                      if (event.key === "Escape") finalizarEdicao(false);
                    }}
                    className="h-7 bg-background/80 text-foreground"
                    aria-label="Nome da coluna"
                  />
                ) : (
                  <span
                    className="min-w-0 flex-1 cursor-text truncate text-sm font-semibold select-none"
                    onDoubleClick={() => iniciarEdicao(coluna)}
                    title="Clique duas vezes para renomear"
                  >
                    {coluna.nome}
                  </span>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline" className="bg-background/60">
                    {cards.length}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Opções da coluna ${coluna.nome}`}
                          className="size-6"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onClick={() => iniciarEdicao(coluna)}>
                        <Pencil />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={protegida}
                        onClick={() => pedirExclusao(coluna)}
                        className="text-destructive"
                      >
                        <Trash2 />
                        {protegida ? "Apagar (coluna do sistema)" : "Apagar coluna"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {coluna.id === "novo" && (
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/leads/novo" />}>
                  <Plus />
                  Adicionar lead
                </Button>
              )}

              <div className="flex flex-col gap-2">
                {cards.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">Nenhum lead aqui.</p>
                ) : (
                  cards.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      colunas={colunasVisiveis}
                      arrastando={arrastandoId === lead.id}
                      onMover={(colunaId) => mover(lead, colunaId)}
                      onMudou={handleMudou}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        setArrastandoId(lead.id);
                      }}
                      onDragEnd={() => {
                        setArrastandoId(null);
                        setColunaSobre(null);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        <div className="flex w-40 shrink-0 flex-col">
          <Button type="button" variant="outline" className="h-auto min-h-10 border-dashed" onClick={abrirNovaColuna}>
            <Plus />
            Nova coluna
          </Button>
        </div>
      </div>

      <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nova-coluna-nome">Nome</Label>
              <Input
                id="nova-coluna-nome"
                value={novoNome}
                maxLength={40}
                autoFocus
                onChange={(event) => setNovoNome(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && novoNome.trim() && !isPending) confirmarNovaColuna();
                }}
                placeholder="Ex.: Aguardando pagamento"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nova-coluna-cor">Cor</Label>
              <Input
                id="nova-coluna-cor"
                type="color"
                value={novaCor}
                onChange={(event) => setNovaCor(event.target.value)}
                className="h-9 w-20 cursor-pointer p-1"
              />
            </div>
            {erroNova && (
              <p role="alert" className="text-destructive text-sm">
                {erroNova}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNovaAberta(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmarNovaColuna} disabled={!novoNome.trim() || isPending}>
              {isPending ? "Criando..." : "Criar coluna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={apagando !== null} onOpenChange={(aberto) => !aberto && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Apagar a coluna &quot;{apagando?.nome}&quot;? Ela está vazia. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={confirmarExclusao}>
              {isPending ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
