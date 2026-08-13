"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsappConfigFormState } from "@/app/admin/mensagens/configuracao/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function WhatsappConfigForm({
  action,
  defaultValues,
  chaveConfigurada,
}: {
  action: (state: WhatsappConfigFormState, formData: FormData) => Promise<WhatsappConfigFormState>;
  defaultValues: {
    evolution_api_url: string;
    evolution_instance_name: string;
    ativo: boolean;
    template_matricula_criada: string;
    template_lembrete_aula: string;
    template_falta: string;
    template_lead_recontato: string;
  };
  chaveConfigurada: boolean;
}) {
  const [state, formAction] = useActionState<WhatsappConfigFormState, FormData>(action, undefined);
  const values = state?.values ?? defaultValues;

  return (
    <form key={JSON.stringify(state?.values)} action={formAction} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 className="font-medium">Conexão com a Evolution API</h2>

        <div className="flex items-center gap-3">
          <Switch id="ativo" name="ativo" defaultChecked={values.ativo} />
          <Label htmlFor="ativo" className="font-normal">
            Envio automático de mensagens ativo
          </Label>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="evolution_api_url">URL da instância</Label>
          <Input
            id="evolution_api_url"
            name="evolution_api_url"
            placeholder="https://minha-evolution-api.com"
            defaultValue={values.evolution_api_url}
          />
          {state?.errors?.evolution_api_url && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.evolution_api_url[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="evolution_instance_name">Nome da instância</Label>
          <Input
            id="evolution_instance_name"
            name="evolution_instance_name"
            defaultValue={values.evolution_instance_name}
          />
          {state?.errors?.evolution_instance_name && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.evolution_instance_name[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="evolution_api_key">Chave da API</Label>
          <Input
            id="evolution_api_key"
            name="evolution_api_key"
            type="password"
            placeholder={chaveConfigurada ? "•••••••• (configurada — deixe em branco pra manter)" : "Não configurada"}
          />
          <p className="text-muted-foreground text-sm">
            Por segurança, a chave salva nunca é exibida aqui. Deixe em branco para manter a atual.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-medium">Modelos de mensagem</h2>
        <p className="text-muted-foreground text-sm">
          Variáveis disponíveis: {"{nome_aluno}"}, {"{nome_curso}"}, {"{nome_turma}"}, {"{data_aula}"},{" "}
          {"{horario_aula}"} (nome_turma só na mensagem de matrícula criada).
        </p>
        <p className="text-muted-foreground text-sm">
          Recontato de lead usa variáveis próprias: {"{nome_lead}"}, {"{nome_curso}"}, {"{nome_turma}"},{" "}
          {"{data_inicio_turma}"} (as duas últimas só têm valor real quando disparado por uma turma nova —
          no envio manual, aparecem como &quot;a definir&quot;).
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="template_matricula_criada">Matrícula criada</Label>
          <Textarea
            id="template_matricula_criada"
            name="template_matricula_criada"
            rows={3}
            defaultValue={values.template_matricula_criada}
          />
          {state?.errors?.template_matricula_criada && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.template_matricula_criada[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="template_lembrete_aula">Lembrete de aula (1 dia antes)</Label>
          <Textarea
            id="template_lembrete_aula"
            name="template_lembrete_aula"
            rows={3}
            defaultValue={values.template_lembrete_aula}
          />
          {state?.errors?.template_lembrete_aula && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.template_lembrete_aula[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="template_falta">Sentimos sua falta</Label>
          <Textarea id="template_falta" name="template_falta" rows={3} defaultValue={values.template_falta} />
          {state?.errors?.template_falta && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.template_falta[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="template_lead_recontato">Recontato de lead</Label>
          <Textarea
            id="template_lead_recontato"
            name="template_lead_recontato"
            rows={3}
            defaultValue={values.template_lead_recontato}
          />
          {state?.errors?.template_lead_recontato && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.template_lead_recontato[0]}
            </p>
          )}
        </div>
      </div>

      {state?.success && <p className="text-sm text-green-600 dark:text-green-500">Configuração salva.</p>}
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
