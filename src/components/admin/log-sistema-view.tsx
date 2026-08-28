"use client";

import { useEffect, useMemo, useState } from "react";
import { getLogSistema, type LogSistemaEntrada } from "@/app/admin/configuracoes/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TIPO_LABELS: Record<LogSistemaEntrada["tipo"], string> = {
  webhook_asaas: "Webhook Asaas",
  presenca: "Presença",
  parcela: "Parcela",
  certificado: "Certificado",
};

const TIPO_FILTRO_TODOS = "todos";
const TIPO_FILTRO_ITEMS: Record<string, string> = {
  [TIPO_FILTRO_TODOS]: "Todos os tipos",
  ...TIPO_LABELS,
};

function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

export function LogSistemaView() {
  const [entradas, setEntradas] = useState<LogSistemaEntrada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<string>(TIPO_FILTRO_TODOS);

  useEffect(() => {
    let cancelado = false;
    getLogSistema()
      .then((dados) => {
        if (!cancelado) setEntradas(dados);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar o log do sistema.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const entradasFiltradas = useMemo(() => {
    if (!entradas) return [];
    return entradas.filter((entrada) => tipoFiltro === TIPO_FILTRO_TODOS || entrada.tipo === tipoFiltro);
  }, [entradas, tipoFiltro]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Últimas ações registradas no sistema. Log completo com todo tipo de ação será implementado
        em versão futura, com uma tabela dedicada de auditoria.
      </p>

      <Select
        items={TIPO_FILTRO_ITEMS}
        value={tipoFiltro}
        onValueChange={(value) => setTipoFiltro(value as string)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(TIPO_FILTRO_ITEMS).map((tipo) => (
            <SelectItem key={tipo} value={tipo}>
              {TIPO_FILTRO_ITEMS[tipo]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : entradas === null ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Carregando...</p>
      ) : entradasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma ação registrada ainda.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entradasFiltradas.map((entrada) => (
              <TableRow key={entrada.id}>
                <TableCell>{formatDataHora(entrada.dataHora)}</TableCell>
                <TableCell>{TIPO_LABELS[entrada.tipo]}</TableCell>
                <TableCell>{entrada.descricao}</TableCell>
                <TableCell>{entrada.usuario}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
