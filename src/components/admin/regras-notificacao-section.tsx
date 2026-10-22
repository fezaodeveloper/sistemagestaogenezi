"use client";

import { useState, useTransition } from "react";
import { listarRegras, toggleRegra } from "@/app/admin/configuracoes/regras-notificacao-actions";
import {
  REGRA_NOTIFICACAO_RECORRENCIA_LABELS,
  REGRA_NOTIFICACAO_TIPO_LABELS,
  type RegraNotificacao,
} from "@/lib/regras-notificacao/schema";
import { RegraNotificacaoDialog } from "@/components/admin/regra-notificacao-dialog";
import { DeleteRegraNotificacaoButton } from "@/components/admin/delete-regra-notificacao-button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDataBR(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [ano, mes, dia] = isoDate.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function StatusToggle({
  id,
  ativoInicial,
}: {
  id: string;
  ativoInicial: boolean;
}) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setAtivo(checked);
    startTransition(async () => {
      const resultado = await toggleRegra(id, checked);
      if (resultado.error) setAtivo(!checked);
    });
  }

  return <Switch checked={ativo} disabled={isPending} onCheckedChange={(checked) => handleChange(checked === true)} />;
}

export function RegrasNotificacaoSection({ regrasIniciais }: { regrasIniciais: RegraNotificacao[] }) {
  const [regras, setRegras] = useState(regrasIniciais);

  async function recarregar() {
    setRegras(await listarRegras());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Regras de recorrência pra lembretes de aula e mensagens personalizadas de WhatsApp/Telegram.
        </p>
        <RegraNotificacaoDialog onSalvo={recarregar} />
      </div>

      {regras.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Nenhuma regra cadastrada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead>Próxima execução</TableHead>
              <TableHead>Última execução</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regras.map((regra) => (
              <TableRow key={regra.id}>
                <TableCell className="font-medium">{regra.nome}</TableCell>
                <TableCell>{REGRA_NOTIFICACAO_TIPO_LABELS[regra.tipo]}</TableCell>
                <TableCell>{REGRA_NOTIFICACAO_RECORRENCIA_LABELS[regra.recorrencia]}</TableCell>
                <TableCell>{formatDataBR(regra.proxima_execucao)}</TableCell>
                <TableCell>{formatDataBR(regra.ultima_execucao)}</TableCell>
                <TableCell>
                  <StatusToggle id={regra.id} ativoInicial={regra.ativo} />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <RegraNotificacaoDialog regra={regra} onSalvo={recarregar} />
                  <DeleteRegraNotificacaoButton id={regra.id} nome={regra.nome} onExcluido={recarregar} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
