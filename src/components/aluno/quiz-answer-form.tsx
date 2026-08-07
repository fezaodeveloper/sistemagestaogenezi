"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { SubmeterQuizState } from "@/app/aluno/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/quiz/actions";

type QuestaoParaResponder = {
  id: string;
  tipo: "multipla_escolha" | "verdadeiro_falso" | "dissertativa";
  enunciado: string;
  ordem: number;
  alternativas: { id: string; texto: string; ordem: number }[];
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando..." : label}
    </Button>
  );
}

export function QuizAnswerForm({
  action,
  questoes,
  submitLabel,
}: {
  action: (state: SubmeterQuizState, formData: FormData) => Promise<SubmeterQuizState>;
  questoes: QuestaoParaResponder[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<SubmeterQuizState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {questoes.map((questao, index) => (
        <Card key={questao.id}>
          <CardHeader>
            <CardTitle className="text-base font-normal">
              {index + 1}. {questao.enunciado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {questao.tipo === "dissertativa" ? (
              <Textarea name={`questao_${questao.id}`} rows={4} required />
            ) : (
              <RadioGroup name={`questao_${questao.id}`} required>
                {questao.alternativas.map((alternativa) => (
                  <div key={alternativa.id} className="flex items-center gap-2">
                    <RadioGroupItem value={alternativa.id} id={`alt-${alternativa.id}`} />
                    <Label htmlFor={`alt-${alternativa.id}`} className="font-normal">
                      {alternativa.texto}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      ))}

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
