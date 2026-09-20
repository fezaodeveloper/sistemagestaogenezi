"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteLeadsEmLote, enviarRecontatoLeads, updateLeadStatus } from "@/app/admin/leads/actions";
import { ExcluirSelecionadosButton } from "@/components/admin/excluir-selecionados";
import { descreverResultadoLote, type ResultadoExclusaoLote } from "@/lib/exclusao-em-lote";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteLeadButton } from "@/components/admin/delete-lead-button";
import {
  KANBAN_COLUNAS_ENCERRADAS,
  LEAD_ORIGEM_LABELS,
  LEAD_STATUSES,
  LEAD_STATUSES_AUTOMATICOS,
  LEAD_STATUS_LABELS,
  TEMPERATURA_BADGE_CLASS,
  TEMPERATURA_LABELS,
  type KanbanColunaConfig,
} from "@/lib/leads/schema";
import type { LeadComCurso } from "@/lib/leads/leads";
import { LIMITE_PADRAO } from "@/lib/paginacao";

const FILTRO_TODOS = "todos";
const TEMPERATURA_FILTRO_ITEMS: Record<string, string> = { [FILTRO_TODOS]: "Todas", ...TEMPERATURA_LABELS };

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

function proximaAcaoVencida(lead: LeadComCurso): boolean {
  return (
    !!lead.proxima_acao &&
    lead.proxima_acao < new Date().toISOString().slice(0, 10) &&
    !KANBAN_COLUNAS_ENCERRADAS.includes(lead.kanban_coluna)
  );
}

function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string | null) {
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, value);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        key={status}
        items={LEAD_STATUS_LABELS}
        defaultValue={status}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
              {LEAD_STATUSES_AUTOMATICOS.includes(s) ? " (auto)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function TabelaLeads({
  itens,
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
  temperatura,
  coluna,
  campanha,
  colunas,
  campanhas,
}: {
  itens: LeadComCurso[];
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
  temperatura: string;
  coluna: string;
  campanha: string;
  colunas: KanbanColunaConfig[];
  campanhas: string[];
}) {
  const router = useRouter();
  const colunaFiltroItems: Record<string, string> = {
    [FILTRO_TODOS]: "Todas",
    ...Object.fromEntries(colunas.map((c) => [c.id, c.nome])),
  };
  const campanhaFiltroItems: Record<string, string> = {
    [FILTRO_TODOS]: "Todas",
    ...Object.fromEntries(campanhas.map((c) => [c, c])),
  };
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function construirUrl(overrides: { temperatura?: string; coluna?: string; campanha?: string }) {
    const params = new URLSearchParams();
    const t = overrides.temperatura ?? temperatura;
    const c = overrides.coluna ?? coluna;
    const camp = overrides.campanha ?? campanha;
    if (t && t !== FILTRO_TODOS) params.set("temperatura", t);
    if (c && c !== FILTRO_TODOS) params.set("coluna", c);
    if (camp && camp !== FILTRO_TODOS) params.set("campanha", camp);
    if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
    const queryString = params.toString();
    return queryString ? `/admin/leads?${queryString}` : "/admin/leads";
  }

  function handleTemperaturaChange(valor: string | null) {
    if (!valor) return;
    router.push(construirUrl({ temperatura: valor }));
  }

  function handleColunaChange(valor: string | null) {
    if (!valor) return;
    router.push(construirUrl({ coluna: valor }));
  }

  function handleCampanhaChange(valor: string | null) {
    if (!valor) return;
    router.push(construirUrl({ campanha: valor }));
  }

  // A seleção só vale pra o que está na tela: ao trocar de página/filtro (itens
  // novos), tira da seleção o que saiu da lista — senão uma exclusão em lote
  // poderia atingir leads que o admin não está vendo. Ajuste de estado derivado
  // durante o render (mesmo padrão de matriculas-table.tsx), não um useEffect.
  const [itensAnteriores, setItensAnteriores] = useState(itens);
  if (itens !== itensAnteriores) {
    setItensAnteriores(itens);
    const visiveis = new Set(itens.map((item) => item.id));
    setSelecionados((prev) => {
      const podados = Array.from(prev).filter((id) => visiveis.has(id));
      return podados.length === prev.size ? prev : new Set(podados);
    });
  }

  function toggleUm(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados((prev) => (prev.size === itens.length ? new Set() : new Set(itens.map((i) => i.id))));
  }

  function enviarRecontato() {
    setError(null);
    setSucesso(null);
    const ids = Array.from(selecionados);
    startTransition(async () => {
      const result = await enviarRecontatoLeads(ids);
      if (result.error) {
        setError(result.error);
      } else {
        setSucesso(
          `Recontato disparado para ${ids.length} lead${ids.length > 1 ? "s" : ""} — confira o resultado em Mensagens.`,
        );
        setSelecionados(new Set());
      }
    });
  }

  const todosSelecionados = itens.length > 0 && selecionados.size === itens.length;

  function aoExcluirLote(resultado: ResultadoExclusaoLote) {
    setError(resultado.erro ?? null);
    setSucesso(resultado.erro ? null : descreverResultadoLote(resultado));
    setSelecionados(new Set(resultado.falhas));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Temperatura</span>
          <Select items={TEMPERATURA_FILTRO_ITEMS} value={temperatura || FILTRO_TODOS} onValueChange={handleTemperaturaChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TEMPERATURA_FILTRO_ITEMS).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {TEMPERATURA_FILTRO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Coluna Kanban</span>
          <Select items={colunaFiltroItems} value={coluna || FILTRO_TODOS} onValueChange={handleColunaChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(colunaFiltroItems).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {colunaFiltroItems[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Campanha de origem</span>
          <Select items={campanhaFiltroItems} value={campanha || FILTRO_TODOS} onValueChange={handleCampanhaChange}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(campanhaFiltroItems).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {campanhaFiltroItems[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {selecionados.size > 0
            ? `${selecionados.size} item(s) selecionado(s)`
            : "Selecione um ou mais leads para disparar recontato."}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={selecionados.size === 0 || isPending} onClick={enviarRecontato}>
            {isPending
              ? "Enviando..."
              : `Enviar recontato${selecionados.size > 0 ? ` (${selecionados.size})` : ""}`}
          </Button>
          {selecionados.size > 0 && (
            <ExcluirSelecionadosButton
              quantidade={selecionados.size}
              onExcluir={() => deleteLeadsEmLote(Array.from(selecionados))}
              onConcluido={aoExcluirLote}
              aviso="Os leads também saem do Kanban."
            />
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {sucesso && <p className="text-sm text-green-600 dark:text-green-500">{sucesso}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todosSelecionados}
                  indeterminate={selecionados.size > 0 && !todosSelecionados}
                  onCheckedChange={toggleTodos}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Próxima ação</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((lead) => {
              const vencida = proximaAcaoVencida(lead);
              return (
              <TableRow key={lead.id} className={vencida ? "bg-amber-500/10" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selecionados.has(lead.id)}
                    onCheckedChange={() => toggleUm(lead.id)}
                    aria-label={`Selecionar ${lead.nome}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{lead.nome}</TableCell>
                <TableCell>{lead.telefone}</TableCell>
                <TableCell>{lead.nomeCurso ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{LEAD_ORIGEM_LABELS[lead.origem]}</Badge>
                </TableCell>
                <TableCell>
                  <LeadStatusSelect leadId={lead.id} status={lead.status} />
                </TableCell>
                <TableCell>
                  {lead.temperatura ? (
                    <Badge className={TEMPERATURA_BADGE_CLASS[lead.temperatura]}>
                      {TEMPERATURA_LABELS[lead.temperatura]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className={vencida ? "font-medium text-amber-700 dark:text-amber-400" : undefined}>
                  {formatDataCurta(lead.proxima_acao) ?? "—"}
                </TableCell>
                <TableCell>{formatDateBR(lead.created_at)}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    nativeButton={false}
                    render={<Link href={`/admin/leads/${lead.id}/editar`} />}
                  >
                    Editar
                  </Button>
                  <DeleteLeadButton id={lead.id} nome={lead.nome} />
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/leads"
        searchParams={{
          ...(temperatura ? { temperatura } : {}),
          ...(coluna ? { coluna } : {}),
          ...(campanha ? { campanha } : {}),
        }}
      />
    </div>
  );
}
