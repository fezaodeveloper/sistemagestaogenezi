"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { liberarCertificados } from "@/app/admin/certificados/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import type { CertificadoAguardandoLiberacao } from "@/lib/certificados/certificados";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Armazenado como percentual 0-100 (mesma escala de certificado_nota_minima_percentual
// em /admin/configuracoes) — exibido na escala de 0 a 10 mais familiar (ex.: 85 → "8.5").
function formatNota(nota: number | null): string {
  return nota === null ? "—" : (nota / 10).toFixed(1);
}

function formatFrequencia(frequencia: number | null): string {
  return frequencia === null ? "—" : `${frequencia}%`;
}

const TIPO_FILTRO_TODOS = "todos";
const TIPO_FILTRO_ITEMS: Record<string, string> = {
  [TIPO_FILTRO_TODOS]: "Todos os tipos",
  ...CURSO_TIPO_LABELS,
};

export function TabelaCertificadosLiberacao({
  itens,
}: {
  itens: CertificadoAguardandoLiberacao[];
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>(TIPO_FILTRO_TODOS);

  useEffect(() => {
    if (!sucesso) return;
    const timer = setTimeout(() => setSucesso(null), 3000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (tipoFiltro !== TIPO_FILTRO_TODOS && item.cursoTipo !== tipoFiltro) return false;
      if (!termo) return true;
      const nomeAluno = (item.alunoNome ?? "").toLowerCase();
      const nomeCurso = item.nomeCurso.toLowerCase();
      return nomeAluno.includes(termo) || nomeCurso.includes(termo);
    });
  }, [itens, busca, tipoFiltro]);

  const idsVisiveis = useMemo(() => new Set(itensFiltrados.map((item) => item.id)), [itensFiltrados]);

  // Poda a seleção durante o render quando o filtro muda e algum item
  // selecionado sai da lista visível — ajuste de estado derivado durante o
  // render (ver nota em historico-presencas.tsx), não um useEffect, porque
  // é só sincronização de estado a partir de outro estado, não um efeito
  // colateral de verdade.
  const [idsVisiveisAnterior, setIdsVisiveisAnterior] = useState(idsVisiveis);
  if (idsVisiveis !== idsVisiveisAnterior) {
    setIdsVisiveisAnterior(idsVisiveis);
    setSelecionados((prev) => {
      const podados = Array.from(prev).filter((id) => idsVisiveis.has(id));
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
    setSelecionados((prev) =>
      prev.size === itensFiltrados.length ? new Set() : new Set(itensFiltrados.map((item) => item.id)),
    );
  }

  function liberar(ids: string[]) {
    setError(null);
    setSucesso(null);
    startTransition(async () => {
      const result = await liberarCertificados(ids);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelecionados((prev) => new Set(Array.from(prev).filter((id) => !ids.includes(id))));
      setSucesso(`${ids.length} certificado${ids.length > 1 ? "s" : ""} liberado${ids.length > 1 ? "s" : ""} com sucesso!`);
    });
  }

  const todosSelecionados = itensFiltrados.length > 0 && selecionados.size === itensFiltrados.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por aluno ou curso..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />
        <Select
          items={TIPO_FILTRO_ITEMS}
          value={tipoFiltro}
          onValueChange={(value) => setTipoFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
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
      </div>

      <p className="text-muted-foreground text-sm">
        {itensFiltrados.length} certificado{itensFiltrados.length !== 1 ? "s" : ""} aguardando liberação
      </p>

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

      {sucesso && (
        <p
          role="status"
          className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400"
        >
          {sucesso}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {itensFiltrados.length === 0 ? (
        <Card>
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nenhum certificado encontrado com os filtros aplicados.
          </p>
        </Card>
      ) : (
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
                <TableHead>Nota</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Pendente desde</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensFiltrados.map((c) => (
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
                  <TableCell>{formatNota(c.nota)}</TableCell>
                  <TableCell>{formatFrequencia(c.frequencia)}</TableCell>
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
      )}
    </div>
  );
}
