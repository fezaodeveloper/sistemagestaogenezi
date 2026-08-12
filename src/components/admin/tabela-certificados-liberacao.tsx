"use client";

import { useState, useTransition } from "react";
import { liberarCertificados } from "@/app/admin/certificados/actions";
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
import { CURSO_TIPO_LABELS, type CURSO_TIPOS } from "@/lib/cursos/schema";
import type { CertificadoAguardandoLiberacao } from "@/lib/certificados/certificados";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function TabelaCertificadosLiberacao({
  itens,
}: {
  itens: CertificadoAguardandoLiberacao[];
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  function liberar(ids: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await liberarCertificados(ids);
      if (result.error) setError(result.error);
      else setSelecionados((prev) => new Set(Array.from(prev).filter((id) => !ids.includes(id))));
    });
  }

  const todosSelecionados = itens.length > 0 && selecionados.size === itens.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {selecionados.size > 0
            ? `${selecionados.size} selecionado${selecionados.size > 1 ? "s" : ""}`
            : "Selecione um ou mais certificados para liberar em lote."}
        </p>
        <Button
          size="sm"
          disabled={selecionados.size === 0 || isPending}
          onClick={() => liberar(Array.from(selecionados))}
        >
          {isPending
            ? "Liberando..."
            : `Liberar selecionados${selecionados.size > 0 ? ` (${selecionados.size})` : ""}`}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todosSelecionados}
                  onCheckedChange={toggleTodos}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Pendente desde</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Checkbox
                    checked={selecionados.has(c.id)}
                    onCheckedChange={() => toggleUm(c.id)}
                    aria-label={`Selecionar certificado de ${c.alunoNome ?? "aluno"}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{c.alunoNome ?? "—"}</TableCell>
                <TableCell>{c.nomeCurso}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {CURSO_TIPO_LABELS[c.cursoTipo as (typeof CURSO_TIPOS)[number]] ?? c.cursoTipo}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateBR(c.criadoEm)}</TableCell>
                <TableCell className="flex justify-end">
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => liberar([c.id])}>
                    Liberar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
