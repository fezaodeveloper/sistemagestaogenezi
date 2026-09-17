"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarStatusAgendamento } from "@/app/admin/comercial/agendamentos/actions";
import {
  AGENDAMENTO_STATUS_BADGE_CLASS,
  AGENDAMENTO_STATUS_LABELS,
  type Agendamento,
  type AgendamentoStatus,
  type CampoExtra,
} from "@/lib/agendamentos/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = { [FILTRO_TODOS]: "Todos os status", ...AGENDAMENTO_STATUS_LABELS };

function formatDateBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function AcoesAgendamento({ agendamento }: { agendamento: Agendamento }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function mudar(status: AgendamentoStatus) {
    startTransition(async () => {
      await atualizarStatusAgendamento(agendamento.id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {agendamento.status !== "realizado" && (
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => mudar("realizado")}>
          Realizado
        </Button>
      )}
      {agendamento.status !== "faltou" && (
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => mudar("faltou")}>
          Faltou
        </Button>
      )}
      {agendamento.status !== "cancelado" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={isPending}
          onClick={() => mudar("cancelado")}
        >
          Cancelar
        </Button>
      )}
    </div>
  );
}

export function AgendamentosListaView({
  paginaId,
  agendamentos,
  camposExtrasConfigurados,
  dataFiltro,
  statusFiltro,
}: {
  paginaId: string;
  agendamentos: Agendamento[];
  camposExtrasConfigurados: CampoExtra[];
  dataFiltro: string;
  statusFiltro: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(dataFiltro);

  function construirUrl(overrides: { data?: string; status?: string }) {
    const params = new URLSearchParams();
    const d = overrides.data ?? data;
    const s = overrides.status ?? statusFiltro;
    if (d) params.set("data", d);
    if (s && s !== FILTRO_TODOS) params.set("status", s);
    const queryString = params.toString();
    return queryString
      ? `/admin/comercial/agendamentos/${paginaId}?${queryString}`
      : `/admin/comercial/agendamentos/${paginaId}`;
  }

  function handleDataChange(valor: string) {
    setData(valor);
    router.push(construirUrl({ data: valor }));
  }

  function handleStatusChange(valor: string | null) {
    if (!valor) return;
    router.push(construirUrl({ status: valor }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Data</span>
          <Input type="date" value={data} onChange={(event) => handleDataChange(event.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Status</span>
          <Select items={STATUS_FILTRO_ITEMS} value={statusFiltro || FILTRO_TODOS} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STATUS_FILTRO_ITEMS).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {STATUS_FILTRO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {agendamentos.length === 0 ? (
        <Card>
          <p className="text-muted-foreground py-10 text-center text-sm">
            {dataFiltro || statusFiltro
              ? "Nenhum agendamento encontrado com os filtros aplicados."
              : "Nenhum agendamento ainda para esta página."}
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Status</TableHead>
                {camposExtrasConfigurados.length > 0 && <TableHead>Campos extras</TableHead>}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agendamentos.map((agendamento) => (
                <TableRow key={agendamento.id}>
                  <TableCell className="font-medium">{agendamento.nome}</TableCell>
                  <TableCell>
                    <a
                      href={`https://wa.me/55${agendamento.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {agendamento.whatsapp}
                    </a>
                  </TableCell>
                  <TableCell>{formatDateBR(agendamento.data_agendada)}</TableCell>
                  <TableCell>{agendamento.horario}</TableCell>
                  <TableCell>
                    <Badge className={AGENDAMENTO_STATUS_BADGE_CLASS[agendamento.status]}>
                      {AGENDAMENTO_STATUS_LABELS[agendamento.status]}
                    </Badge>
                  </TableCell>
                  {camposExtrasConfigurados.length > 0 && (
                    <TableCell className="text-muted-foreground text-xs">
                      {camposExtrasConfigurados
                        .map((campo) => agendamento.campos_extras?.[campo.nome])
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <AcoesAgendamento agendamento={agendamento} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
