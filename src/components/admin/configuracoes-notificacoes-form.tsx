"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarNotificacoes, type NotificacoesFormState } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ConfiguracoesNotificacoes } from "@/lib/configuracoes/schema";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Salvando..." : "Salvar preferências"}
    </Button>
  );
}

const OPCOES = [
  {
    name: "notif_financeiro_atrasado",
    label: "Pagamentos em atraso",
    descricao: "Sino toca quando há parcelas atrasadas.",
  },
  {
    name: "notif_certificados_pendentes",
    label: "Certificados pendentes",
    descricao: "Sino toca quando há certificados aguardando liberação.",
  },
  {
    name: "notif_eventos_hoje",
    label: "Eventos hoje",
    descricao: "Sino toca quando há eventos do calendário no dia.",
  },
  {
    name: "notif_eventos_amanha",
    label: "Eventos amanhã",
    descricao: "Sino toca quando há eventos do calendário no dia seguinte.",
  },
] as const;

export function ConfiguracoesNotificacoesForm({
  defaultValues,
}: {
  defaultValues: ConfiguracoesNotificacoes;
}) {
  const [state, formAction] = useActionState<NotificacoesFormState, FormData>(salvarNotificacoes, undefined);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {OPCOES.map((opcao) => (
        <div key={opcao.name} className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={opcao.name} className="font-normal">
              {opcao.label}
            </Label>
            <span className="text-muted-foreground text-xs">{opcao.descricao}</span>
          </div>
          <Switch id={opcao.name} name={opcao.name} defaultChecked={defaultValues[opcao.name]} />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.salvo && !state.error && <span className="text-muted-foreground text-sm">Salvo.</span>}
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
