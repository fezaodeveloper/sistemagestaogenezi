"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function turmasAtivasLabel(aluno: AlunoListItem) {
  const nomes = aluno.matriculas
    .filter((matricula) => matricula.status === "ativa")
    .map((matricula) => matricula.turmas?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return nomes.length > 0 ? nomes.join(", ") : "—";
}

export function AlunosTable({ alunos }: { alunos: AlunoListItem[] }) {
  const [busca, setBusca] = useState("");

  // Filtro client-side simples: a lista de alunos já vem inteira do
  // Server Component (sem paginação hoje), então não há necessidade de ida
  // e volta ao servidor só pra buscar por nome/CPF/telefone.
  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return alunos;

    const termoDigits = onlyDigits(busca);

    return alunos.filter((aluno) => {
      const nome = (aluno.profiles?.full_name ?? "").toLowerCase();
      if (nome.includes(termo)) return true;
      if (termoDigits.length === 0) return false;
      return aluno.cpf.includes(termoDigits) || aluno.telefone.includes(termoDigits);
    });
  }, [alunos, busca]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Buscar por nome, CPF ou telefone..."
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
        className="max-w-sm"
      />

      {alunosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum aluno encontrado para &quot;{busca}&quot;.
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
                  {isMinor(aluno.data_nascimento) ? (
                    <Badge variant="secondary">Menor de idade</Badge>
                  ) : (
                    "Maior de idade"
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
