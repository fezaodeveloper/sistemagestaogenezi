"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ESTOQUE_CATEGORIAS,
  ESTOQUE_CATEGORIA_LABELS,
  type EstoqueCategoria,
} from "@/lib/estoque/schema";
import type { EstoqueItemFormState } from "@/app/admin/estoque/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function EstoqueItemForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: EstoqueItemFormState, formData: FormData) => Promise<EstoqueItemFormState>;
  defaultValues?: {
    nome: string;
    categoria: EstoqueCategoria;
    quantidade_atual: number;
    quantidade_minima: number;
    unidade: string;
    observacoes: string;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<EstoqueItemFormState, FormData>(action, undefined);

  const values = state?.values ?? {
    nome: defaultValues?.nome ?? "",
    categoria: defaultValues?.categoria ?? "outro",
    quantidade_atual: String(defaultValues?.quantidade_atual ?? 0),
    quantidade_minima: String(defaultValues?.quantidade_minima ?? 5),
    unidade: defaultValues?.unidade ?? "unidade",
    observacoes: defaultValues?.observacoes ?? "",
  };

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Item</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" defaultValue={values.nome} required />
            {state?.errors?.nome && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.nome[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select name="categoria" items={ESTOQUE_CATEGORIA_LABELS} defaultValue={values.categoria}>
              <SelectTrigger id="categoria" className="w-full">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {ESTOQUE_CATEGORIAS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {ESTOQUE_CATEGORIA_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state?.errors?.categoria && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.categoria[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantidade_atual">Quantidade atual</Label>
              <Input
                id="quantidade_atual"
                name="quantidade_atual"
                type="number"
                min={0}
                defaultValue={values.quantidade_atual}
                required
              />
              {state?.errors?.quantidade_atual && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.quantidade_atual[0]}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantidade_minima">Quantidade mínima</Label>
              <Input
                id="quantidade_minima"
                name="quantidade_minima"
                type="number"
                min={0}
                defaultValue={values.quantidade_minima}
                required
              />
              {state?.errors?.quantidade_minima && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.quantidade_minima[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="unidade">Unidade</Label>
            <Input id="unidade" name="unidade" placeholder="unidade, caixa, par..." defaultValue={values.unidade} required />
            {state?.errors?.unidade && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.unidade[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={values.observacoes} placeholder="Opcional" />
            {state?.errors?.observacoes && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.observacoes[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Button variant="outline" render={<Link href="/admin/estoque" />} nativeButton={false}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
