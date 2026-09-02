"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PremioFormState } from "@/app/admin/premios/actions";

type DefaultValues = {
  nome?: string;
  descricao?: string;
  custo_creditos?: number | string;
  estoque?: number | string;
  estoque_minimo?: number | string;
  ativo?: boolean | string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function PremioForm({
  action,
  defaultValues,
  fotoAtualUrl,
  submitLabel,
}: {
  action: (state: PremioFormState, formData: FormData) => Promise<PremioFormState>;
  defaultValues?: DefaultValues;
  fotoAtualUrl?: string | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<PremioFormState, FormData>(action, undefined);
  const values = state?.values ?? defaultValues;

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      encType="multipart/form-data"
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={values?.nome} required />
        {state?.errors?.nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.nome[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={values?.descricao} rows={4} />
        {state?.errors?.descricao && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.descricao[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="foto">Foto</Label>
        {fotoAtualUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- preview de foto já enviada, bucket público
          <img src={fotoAtualUrl} alt="Foto atual" className="h-32 w-32 rounded-md object-cover" />
        )}
        <Input id="foto" name="foto" type="file" accept="image/*" />
        <p className="text-muted-foreground text-xs">
          {fotoAtualUrl ? "Envie um novo arquivo pra substituir a foto atual." : "Opcional."}
        </p>
        {state?.errors?.foto && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.foto[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="custo_creditos">Custo em créditos</Label>
        <Input
          id="custo_creditos"
          name="custo_creditos"
          type="number"
          min={1}
          step={1}
          defaultValue={values?.custo_creditos}
          required
        />
        {state?.errors?.custo_creditos && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.custo_creditos[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="estoque">Estoque</Label>
        <Input id="estoque" name="estoque" type="number" min={0} step={1} defaultValue={values?.estoque} />
        <p className="text-muted-foreground text-xs">Deixe em branco para estoque ilimitado.</p>
        {state?.errors?.estoque && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.estoque[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="estoque_minimo">Estoque mínimo para alerta</Label>
        <Input
          id="estoque_minimo"
          name="estoque_minimo"
          type="number"
          min={0}
          step={1}
          defaultValue={values?.estoque_minimo ?? 5}
        />
        <p className="text-muted-foreground text-xs">
          Quando o estoque cair até esse valor (ou menos), a escola recebe um alerta no Telegram.
        </p>
        {state?.errors?.estoque_minimo && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.estoque_minimo[0]}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="ativo"
          name="ativo"
          defaultChecked={values?.ativo === undefined ? true : values.ativo === true || values.ativo === "on"}
        />
        <Label htmlFor="ativo" className="font-normal">
          Visível para os alunos no catálogo de resgate
        </Label>
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
