"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { enviarRecontatoLeads, updateLeadStatus } from "@/app/admin/leads/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  LEAD_ORIGEM_LABELS,
  LEAD_STATUSES,
  LEAD_STATUSES_AUTOMATICOS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/schema";
import type { LeadComCurso } from "@/lib/leads/leads";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
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

export function TabelaLeads({ itens }: { itens: LeadComCurso[] }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {selecionados.size > 0
            ? `${selecionados.size} selecionado${selecionados.size > 1 ? "s" : ""}`
            : "Selecione um ou mais leads para disparar recontato."}
        </p>
        <Button size="sm" disabled={selecionados.size === 0 || isPending} onClick={enviarRecontato}>
          {isPending
            ? "Enviando..."
            : `Enviar recontato${selecionados.size > 0 ? ` (${selecionados.size})` : ""}`}
        </Button>
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
                <Checkbox checked={todosSelecionados} onCheckedChange={toggleTodos} aria-label="Selecionar todos" />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((lead) => (
              <TableRow key={lead.id}>
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
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
