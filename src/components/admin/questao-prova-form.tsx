"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUESTAO_TIPOS, QUESTAO_TIPO_LABELS } from "@/lib/questoes/schema";
import type { QuestaoProvaFormState } from "@/app/admin/cursos/[id]/modulos/[moduloId]/prova/questoes/actions";

type Tipo = (typeof QUESTAO_TIPOS)[number];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

let alternativaKeySeq = 0;
function novaAlternativaKey() {
  alternativaKeySeq += 1;
  return `alt-prova-${alternativaKeySeq}`;
}

export function QuestaoProvaForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: QuestaoProvaFormState, formData: FormData) => Promise<QuestaoProvaFormState>;
  defaultValues?: {
    tipo?: Tipo;
    enunciado?: string;
    ordem?: number | string;
    alternativas?: { texto: string; correta: boolean }[];
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<QuestaoProvaFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs (e os useState abaixo) com os valores ecoados.
  const values = state?.values ?? defaultValues;
  const [tipo, setTipo] = useState<Tipo>((values?.tipo as Tipo) || "multipla_escolha");

  const [alternativas, setAlternativas] = useState(() =>
    defaultValues?.tipo === "multipla_escolha" && defaultValues.alternativas?.length
      ? defaultValues.alternativas.map((a) => ({ key: novaAlternativaKey(), texto: a.texto }))
      : [
          { key: novaAlternativaKey(), texto: "" },
          { key: novaAlternativaKey(), texto: "" },
        ],
  );

  const correctIndexVerdadeiroFalso = (() => {
    if (defaultValues?.tipo !== "verdadeiro_falso") return "0";
    const index = defaultValues.alternativas?.findIndex((a) => a.correta) ?? -1;
    return index >= 0 ? String(index) : "0";
  })();

  const correctIndexMultiplaEscolha = (() => {
    if (defaultValues?.tipo !== "multipla_escolha") return undefined;
    const index = defaultValues.alternativas?.findIndex((a) => a.correta) ?? -1;
    return index >= 0 ? String(index) : undefined;
  })();

  function adicionarAlternativa() {
    setAlternativas((atual) => [...atual, { key: novaAlternativaKey(), texto: "" }]);
  }

  function removerAlternativa(key: string) {
    setAlternativas((atual) => (atual.length > 2 ? atual.filter((a) => a.key !== key) : atual));
  }

  function atualizarTexto(key: string, texto: string) {
    setAlternativas((atual) => atual.map((a) => (a.key === key ? { ...a, texto } : a)));
  }

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo">Tipo</Label>
        <Select
          name="tipo"
          items={QUESTAO_TIPO_LABELS}
          defaultValue={values?.tipo || "multipla_escolha"}
          onValueChange={(value) => {
            if (value) setTipo(value as Tipo);
          }}
        >
          <SelectTrigger id="tipo" className="w-full">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {QUESTAO_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {QUESTAO_TIPO_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="enunciado">Enunciado</Label>
        <Textarea
          id="enunciado"
          name="enunciado"
          rows={3}
          defaultValue={values?.enunciado}
          required
        />
        {state?.errors?.enunciado && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.enunciado[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ordem">Ordem</Label>
        <Input
          id="ordem"
          name="ordem"
          type="number"
          min={1}
          defaultValue={values?.ordem}
          required
        />
        {state?.errors?.ordem && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.ordem[0]}
          </p>
        )}
      </div>

      {tipo === "verdadeiro_falso" && (
        <div className="flex flex-col gap-2">
          <Label>Qual é a correta?</Label>
          <RadioGroup name="alternativa_correta" defaultValue={correctIndexVerdadeiroFalso}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="0" id="vf-verdadeiro" />
              <Label htmlFor="vf-verdadeiro" className="font-normal">
                Verdadeiro
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="1" id="vf-falso" />
              <Label htmlFor="vf-falso" className="font-normal">
                Falso
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {tipo === "multipla_escolha" && (
        <div className="flex flex-col gap-2">
          <Label>Alternativas (marque a correta)</Label>
          <RadioGroup name="alternativa_correta" defaultValue={correctIndexMultiplaEscolha}>
            {alternativas.map((alternativa, index) => (
              <div key={alternativa.key} className="flex items-center gap-2">
                <RadioGroupItem value={String(index)} id={`alt-correta-${alternativa.key}`} />
                <Input
                  name="alternativa_texto"
                  value={alternativa.texto}
                  onChange={(event) => atualizarTexto(alternativa.key, event.target.value)}
                  placeholder={`Alternativa ${index + 1}`}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover alternativa"
                  disabled={alternativas.length <= 2}
                  onClick={() => removerAlternativa(alternativa.key)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </RadioGroup>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={adicionarAlternativa}>
              <Plus />
              Adicionar alternativa
            </Button>
          </div>
        </div>
      )}

      {state?.errors?.alternativas && (
        <p role="alert" className="text-destructive text-sm">
          {state.errors.alternativas[0]}
        </p>
      )}

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
