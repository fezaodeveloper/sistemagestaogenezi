"use client";

import { useState, useTransition } from "react";
import { reenviarMensagem } from "@/app/admin/mensagens/actions";
import { Button } from "@/components/ui/button";
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
import { MENSAGEM_STATUS_LABELS, MENSAGEM_TIPO_LABELS } from "@/lib/mensagens/schema";
import type { MensagemEnviadaComContexto } from "@/lib/mensagens/mensagens";

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function StatusBadge({ status }: { status: MensagemEnviadaComContexto["status"] }) {
  if (status === "enviado") return <Badge>{MENSAGEM_STATUS_LABELS[status]}</Badge>;
  if (status === "falha") return <Badge variant="destructive">{MENSAGEM_STATUS_LABELS[status]}</Badge>;
  return <Badge variant="secondary">{MENSAGEM_STATUS_LABELS[status]}</Badge>;
}

export function TabelaMensagensEnviadas({ itens }: { itens: MensagemEnviadaComContexto[] }) {
  const [isPending, startTransition] = useTransition();
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reenviar(id: string) {
    setError(null);
    setReenviandoId(id);
    startTransition(async () => {
      const result = await reenviarMensagem(id);
      if (result.error) setError(result.error);
      setReenviandoId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">{formatDateTimeBR(m.created_at)}</TableCell>
                <TableCell>{MENSAGEM_TIPO_LABELS[m.tipo]}</TableCell>
                <TableCell className="font-medium">{m.alunoNome ?? "—"}</TableCell>
                <TableCell>{m.nomeCurso ?? "—"}</TableCell>
                <TableCell>{m.telefone_destino}</TableCell>
                <TableCell>
                  <StatusBadge status={m.status} />
                </TableCell>
                <TableCell className="text-muted-foreground max-w-64 truncate text-sm" title={m.erro_detalhe ?? ""}>
                  {m.erro_detalhe ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {m.status === "falha" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => reenviar(m.id)}
                    >
                      {isPending && reenviandoId === m.id ? "Reenviando..." : "Reenviar"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
