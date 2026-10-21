"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { atualizarStatusCursoGratuito } from "@/app/admin/cursos-gratuitos/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteCursoGratuitoButton } from "@/components/admin/delete-curso-gratuito-button";
import { CURSO_STATUSES } from "@/lib/cursos/schema";

export type CursoGratuitoListItem = {
  id: string;
  nome: string;
  descricao: string | null;
  url_plataforma_externa: string | null;
  status: (typeof CURSO_STATUSES)[number];
};

function StatusToggle({ id, statusInicial }: { id: string; statusInicial: (typeof CURSO_STATUSES)[number] }) {
  const [ativo, setAtivo] = useState(statusInicial === "ativo");
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setAtivo(checked);
    startTransition(async () => {
      const resultado = await atualizarStatusCursoGratuito(id, checked);
      // Falhou no servidor: volta o switch pro estado anterior — sem toast nesta tela ainda,
      // mas o switch nunca fica mostrando um estado que não foi de fato salvo.
      if (resultado.error) setAtivo(!checked);
    });
  }

  return <Switch checked={ativo} disabled={isPending} onCheckedChange={(checked) => handleChange(checked === true)} />;
}

export function CursosGratuitosTable({ cursos }: { cursos: CursoGratuitoListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>URL externa</TableHead>
          <TableHead>Ativo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cursos.map((curso) => (
          <TableRow key={curso.id}>
            <TableCell className="font-medium">{curso.nome}</TableCell>
            <TableCell className="max-w-xs truncate text-sm">{curso.descricao || "—"}</TableCell>
            <TableCell className="max-w-xs truncate text-sm">
              {curso.url_plataforma_externa ? (
                <a
                  href={curso.url_plataforma_externa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {curso.url_plataforma_externa}
                </a>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <StatusToggle id={curso.id} statusInicial={curso.status} />
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <Button
                render={<Link href={`/admin/cursos-gratuitos/${curso.id}/editar`} />}
                nativeButton={false}
                variant="ghost"
                size="sm"
              >
                Editar
              </Button>
              <DeleteCursoGratuitoButton id={curso.id} nome={curso.nome} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
