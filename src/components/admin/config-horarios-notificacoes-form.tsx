"use client";

import { useState, useTransition } from "react";
import { atualizarConfigNotificacoes, type ConfigHorariosNotificacoes } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ConfigHorariosNotificacoesForm({
  defaultValues,
}: {
  defaultValues: ConfigHorariosNotificacoes;
}) {
  const [valores, setValores] = useState(defaultValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await atualizarConfigNotificacoes(valores);
      if (resultado.error) setError(resultado.error);
      else setSalvo(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="lembrete-aula-ativo" className="font-normal">
            Lembrete de Aula
          </Label>
          <Switch
            id="lembrete-aula-ativo"
            checked={valores.lembrete_aula_ativo}
            onCheckedChange={(checked) => setValores((v) => ({ ...v, lembrete_aula_ativo: checked === true }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lembrete-aula-horas-antes">Horas antes da aula</Label>
            <Input
              id="lembrete-aula-horas-antes"
              type="number"
              min={1}
              max={48}
              value={valores.lembrete_aula_horas_antes}
              onChange={(e) => setValores((v) => ({ ...v, lembrete_aula_horas_antes: Number(e.target.value) }))}
              disabled={!valores.lembrete_aula_ativo}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lembrete-aula-hora-envio">Enviar às Xh (horário de Brasília)</Label>
            <Input
              id="lembrete-aula-hora-envio"
              type="number"
              min={0}
              max={23}
              value={valores.lembrete_aula_hora_envio}
              onChange={(e) => setValores((v) => ({ ...v, lembrete_aula_hora_envio: Number(e.target.value) }))}
              disabled={!valores.lembrete_aula_ativo}
            />
            <p className="text-muted-foreground text-xs">
              Reservado para plano Vercel Pro — no plano Hobby o cron só pode rodar 1x por dia e
              dispara sempre às 8h, não lê este valor. Salvo pra já ficar pronto quando a escola
              migrar de plano.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="lembrete-pagamento-ativo" className="font-normal">
              Lembrete de Pagamento
            </Label>
            <span className="text-muted-foreground text-xs">
              Reservado — ainda não existe um cron de lembrete ANTES do vencimento no sistema (só
              o de cobrança já atrasada). Sem efeito até esse cron ser criado.
            </span>
          </div>
          <Switch
            id="lembrete-pagamento-ativo"
            checked={valores.lembrete_pagamento_ativo}
            onCheckedChange={(checked) => setValores((v) => ({ ...v, lembrete_pagamento_ativo: checked === true }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lembrete-pagamento-dias-antes">Dias antes do vencimento</Label>
            <Input
              id="lembrete-pagamento-dias-antes"
              type="number"
              min={1}
              max={10}
              value={valores.lembrete_pagamento_dias_antes}
              onChange={(e) => setValores((v) => ({ ...v, lembrete_pagamento_dias_antes: Number(e.target.value) }))}
              disabled={!valores.lembrete_pagamento_ativo}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lembrete-pagamento-hora-envio">Enviar às Xh (horário de Brasília)</Label>
            <Input
              id="lembrete-pagamento-hora-envio"
              type="number"
              min={0}
              max={23}
              value={valores.lembrete_pagamento_hora_envio}
              onChange={(e) => setValores((v) => ({ ...v, lembrete_pagamento_hora_envio: Number(e.target.value) }))}
              disabled={!valores.lembrete_pagamento_ativo}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t pt-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="aviso-presenca-ativo" className="font-normal">
            Aviso de presença (Telegram)
          </Label>
          <Switch
            id="aviso-presenca-ativo"
            checked={valores.telegram_aviso_presenca_ativo}
            onCheckedChange={(checked) =>
              setValores((v) => ({ ...v, telegram_aviso_presenca_ativo: checked === true }))
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aviso-presenca-hora-limite">Enviar aviso para turmas com início até</Label>
          <Input
            id="aviso-presenca-hora-limite"
            type="time"
            className="max-w-32"
            value={valores.telegram_aviso_presenca_hora_limite}
            onChange={(e) =>
              setValores((v) => ({ ...v, telegram_aviso_presenca_hora_limite: e.target.value }))
            }
            disabled={!valores.telegram_aviso_presenca_ativo}
          />
          <p className="text-muted-foreground text-xs">
            O cron roda 1x por dia, sempre no mesmo horário (plano Hobby) — por isso este campo
            não é “a que hora envia”, e sim “a partir de que horário de turma o aviso dispara”.
            Ex.: configurado “08:00”, avisa professores de turmas que começam às 07:00, 07:30 ou
            08:00; turmas mais tarde no dia não disparam o aviso.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        {salvo && !error && <span className="text-muted-foreground text-sm">Salvo.</span>}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
