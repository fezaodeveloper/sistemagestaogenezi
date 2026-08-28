"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  FileBadge,
  Package,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pendencia, PendenciaIcone, PendenciaPrioridade } from "@/app/admin/pendencias/actions";

const ICONE_POR_CHAVE: Record<PendenciaIcone, LucideIcon> = {
  parcela: Banknote,
  evasao: AlertTriangle,
  manutencao: Wrench,
  certificado: FileBadge,
  lead: UserPlus,
  estoque: Package,
  frequencia: Users,
};

const PRIORIDADE_LABELS: Record<PendenciaPrioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORIDADE_BADGE_CLASS: Record<PendenciaPrioridade, string> = {
  alta: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  media: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  baixa: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
};

const PRIORIDADE_ICONE_CLASS: Record<PendenciaPrioridade, string> = {
  alta: "bg-red-500/15 text-red-600 dark:text-red-400",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  baixa: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

const FILTRO_TODAS = "todas";
const FILTRO_ITEMS: Record<string, string> = {
  [FILTRO_TODAS]: "Todas as prioridades",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export function PendenciasView({ pendencias }: { pendencias: Pendencia[] }) {
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>(FILTRO_TODAS);

  const pendenciasFiltradas = useMemo(() => {
    if (prioridadeFiltro === FILTRO_TODAS) return pendencias;
    return pendencias.filter((p) => p.prioridade === prioridadeFiltro);
  }, [pendencias, prioridadeFiltro]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Centro de Pendências</h1>
        <p className="text-muted-foreground text-sm">
          Tudo que precisa de atenção, priorizado automaticamente.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {pendencias.length} pendência{pendencias.length === 1 ? "" : "s"} ativa{pendencias.length === 1 ? "" : "s"}
        </p>
        <Select
          items={FILTRO_ITEMS}
          value={prioridadeFiltro}
          onValueChange={(value) => setPrioridadeFiltro(value as string)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(FILTRO_ITEMS).map((chave) => (
              <SelectItem key={chave} value={chave}>
                {FILTRO_ITEMS[chave]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pendencias.length === 0 ? (
        <p className="py-10 text-center text-sm font-medium text-green-600 dark:text-green-400">
          ✓ Nenhuma pendência no momento!
        </p>
      ) : pendenciasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma pendência com essa prioridade.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pendenciasFiltradas.map((pendencia) => {
            const Icone = ICONE_POR_CHAVE[pendencia.icone];
            return (
              <Link key={pendencia.id} href={pendencia.href}>
                <Card className="hover:bg-accent/50 transition-colors">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className={`rounded-full p-2 ${PRIORIDADE_ICONE_CLASS[pendencia.prioridade]}`}>
                      <Icone className="size-4" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">{pendencia.titulo}</span>
                      <span className="text-muted-foreground text-xs">{pendencia.descricao}</span>
                    </div>
                    <Badge className={PRIORIDADE_BADGE_CLASS[pendencia.prioridade]}>
                      {PRIORIDADE_LABELS[pendencia.prioridade]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
