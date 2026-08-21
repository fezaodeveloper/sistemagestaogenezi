"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { DeleteAlunoButton } from "@/components/admin/delete-aluno-button";
import {
  calculateAge,
  formatCpf,
  formatTelefone,
  isMinor,
  onlyDigits,
  STATUS_ALUNO_BADGE_CLASS,
  STATUS_ALUNO_LABELS,
  type AlunoWithRelations,
} from "@/lib/alunos/schema";

export type AlunoListItem = AlunoWithRelations & {
  matriculas: { status: string; turmas: { nome: string } | null }[];
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...STATUS_ALUNO_LABELS,
};

const FAIXA_FILTRO_TODAS = "todas";
const FAIXA_FILTRO_MAIOR = "maior";
const FAIXA_FILTRO_MENOR = "menor";
const FAIXA_FILTRO_ITEMS: Record<string, string> = {
  [FAIXA_FILTRO_TODAS]: "Todas as idades",
  [FAIXA_FILTRO_MAIOR]: "Maior de idade",
  [FAIXA_FILTRO_MENOR]: "Menor de idade",
};

function turmasAtivasLabel(aluno: AlunoListItem) {
  const nomes = aluno.matriculas
    .filter((matricula) => matricula.status === "ativa")
    .map((matricula) => matricula.turmas?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return nomes.length > 0 ? nomes.join(", ") : "—";
}

export function AlunosTable({ alunos }: { alunos: AlunoListItem[] }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [faixaFiltro, setFaixaFiltro] = useState<string>(FAIXA_FILTRO_TODAS);

  // Filtro client-side simples: a lista de alunos já vem inteira do
  // Server Component (sem paginação hoje), então não há necessidade de ida
  // e volta ao servidor só pra buscar/filtrar por nome, CPF, telefone,
  // status ou faixa etária — os três filtros combinam entre si.
  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigits = onlyDigits(busca);

    return alunos.filter((aluno) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && aluno.status_aluno !== statusFiltro) {
        return false;
      }

      if (faixaFiltro !== FAIXA_FILTRO_TODAS) {
        if (!aluno.data_nascimento) return false;
        const menor = isMinor(aluno.data_nascimento);
        if (faixaFiltro === FAIXA_FILTRO_MENOR && !menor) return false;
        if (faixaFiltro === FAIXA_FILTRO_MAIOR && menor) return false;
      }

      if (!termo) return true;

      const nome = (aluno.profiles?.full_name ?? "").toLowerCase();
      if (nome.includes(termo)) return true;
      if (termoDigits.length === 0) return false;
      return aluno.cpf.includes(termoDigits) || aluno.telefone.includes(termoDigits);
    });
  }, [alunos, busca, statusFiltro, faixaFiltro]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />

        <Select
          items={STATUS_FILTRO_ITEMS}
          value={statusFiltro}
          onValueChange={(value) => setStatusFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
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

        <Select
          items={FAIXA_FILTRO_ITEMS}
          value={faixaFiltro}
          onValueChange={(value) => setFaixaFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(FAIXA_FILTRO_ITEMS).map((faixa) => (
              <SelectItem key={faixa} value={faixa}>
                {FAIXA_FILTRO_ITEMS[faixa]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {alunosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum aluno encontrado com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Turmas ativas</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alunosFiltrados.map((aluno) => (
              <TableRow key={aluno.id}>
                <TableCell className="font-medium">{aluno.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{aluno.email}</TableCell>
                <TableCell>{formatCpf(aluno.cpf)}</TableCell>
                <TableCell>{formatTelefone(aluno.telefone)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_ALUNO_BADGE_CLASS[aluno.status_aluno]}>
                    {STATUS_ALUNO_LABELS[aluno.status_aluno]}
                  </Badge>
                </TableCell>
                <TableCell>{turmasAtivasLabel(aluno)}</TableCell>
                <TableCell>
                  {aluno.data_nascimento ? (
                    <div className="flex flex-col gap-1">
                      <span>{calculateAge(aluno.data_nascimento)} anos</span>
                      {isMinor(aluno.data_nascimento) ? (
                        <Badge variant="secondary" className="w-fit">
                          Menor de idade
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit">
                          Maior de idade
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    render={<Link href={`/admin/alunos/${aluno.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <DeleteAlunoButton id={aluno.id} nome={aluno.profiles?.full_name ?? aluno.email} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
