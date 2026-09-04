"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { downloadContrato } from "@/app/admin/matriculas/actions";
import { WhatsappStubButton } from "@/components/admin/whatsapp-stub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ContratoStatus } from "@/lib/contratos/schema";

export type ContratoListItem = {
  id: string;
  matricula_id: string;
  status: ContratoStatus;
  aceito_em: string | null;
  created_at: string;
  alunos: { full_name: string | null; email: string } | null;
  matriculas: { turmas: { nome: string; cursos: { nome: string } | null } | null } | null;
};

const CONTRATO_STATUS_LABELS: Record<ContratoStatus, string> = {
  pendente: "Pendente",
  aceito: "Assinado",
  recusado: "Recusado",
};

const CONTRATO_STATUS_BADGE_CLASS: Record<ContratoStatus, string> = {
  pendente: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  aceito: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  recusado: "bg-muted text-muted-foreground",
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...CONTRATO_STATUS_LABELS,
};

// "21/08/2026 às 14:32" — mesmo formato usado em outras telas do admin
// (ver matriculas-table.tsx).
function formatDataHora(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

function BaixarPdfButton({ matriculaId }: { matriculaId: string }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleBaixar() {
    setErro(null);
    setBaixando(true);
    try {
      const resultado = await downloadContrato(matriculaId);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      const byteCharacters = atob(resultado.pdf);
      const byteNumbers = Array.from(byteCharacters, (caractere) => caractere.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob), "_blank");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={handleBaixar} disabled={baixando}>
        {baixando ? "Baixando..." : "Baixar PDF"}
      </Button>
      {erro && <span className="text-destructive text-xs">{erro}</span>}
    </div>
  );
}

export function ContratosView({ contratos }: { contratos: ContratoListItem[] }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);

  const contratosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter((contrato) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && contrato.status !== statusFiltro) return false;
      if (!termo) return true;
      const nomeAluno = (contrato.alunos?.full_name ?? "").toLowerCase();
      const nomeCurso = (contrato.matriculas?.turmas?.cursos?.nome ?? "").toLowerCase();
      return nomeAluno.includes(termo) || nomeCurso.includes(termo);
    });
  }, [contratos, statusFiltro, busca]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por aluno ou curso..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />
        <Select
          items={STATUS_FILTRO_ITEMS}
          value={statusFiltro}
          onValueChange={(value) => setStatusFiltro(value as string)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(STATUS_FILTRO_ITEMS).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_FILTRO_ITEMS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {contratosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum contrato encontrado com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data assinatura</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratosFiltrados.map((contrato) => (
              <TableRow key={contrato.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{contrato.alunos?.full_name ?? "—"}</span>
                    <span className="text-muted-foreground text-xs">{contrato.alunos?.email ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell>{contrato.matriculas?.turmas?.cursos?.nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={CONTRATO_STATUS_BADGE_CLASS[contrato.status]}>
                    {CONTRATO_STATUS_LABELS[contrato.status]}
                  </Badge>
                </TableCell>
                <TableCell>{formatDataHora(contrato.aceito_em)}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <BaixarPdfButton matriculaId={contrato.matricula_id} />
                  <WhatsappStubButton
                    tipo="contrato"
                    matriculaId={contrato.matricula_id}
                    label="📱 Enviar contrato"
                    disabled={contrato.status === "recusado"}
                  />
                  <Button
                    render={<Link href={`/admin/matriculas/${contrato.matricula_id}`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Ver matrícula
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
