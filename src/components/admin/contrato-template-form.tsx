"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditorTextoCertificado, type EditorTextoCertificadoHandle } from "@/components/admin/editor-texto-certificado";
import { tiptapJsonParaRuns } from "@/lib/certificados/texto";
import { CONTRATO_VARIAVEIS, CONTRATO_VARIAVEL_LABELS, VARIAVEIS_EXEMPLO_CONTRATO } from "@/lib/contratos/schema";
import type { ContratoTemplateFormState } from "@/app/admin/contrato/actions";

// Tamanho de fonte da prévia quando nenhum tamanho é aplicado no editor —
// valor pensado pra corpo de contrato (documento comum), bem menor que
// TAMANHO_FONTE_PADRAO de certificados/texto.ts (22px, pensado pra um
// certificado decorativo de página inteira).
const CONTRATO_TAMANHO_FONTE_PADRAO = 14;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar template"}
    </Button>
  );
}

export function ContratoTemplateForm({
  action,
  defaultValues,
}: {
  action: (state: ContratoTemplateFormState, formData: FormData) => Promise<ContratoTemplateFormState>;
  defaultValues: { conteudo: JSONContent; cor_texto: string };
}) {
  const [state, formAction] = useActionState<ContratoTemplateFormState, FormData>(action, undefined);
  const editorRef = useRef<EditorTextoCertificadoHandle>(null);
  const [conteudoJson, setConteudoJson] = useState<JSONContent>(defaultValues.conteudo);
  const [corTexto, setCorTexto] = useState(defaultValues.cor_texto);

  const linhasPreview = tiptapJsonParaRuns(conteudoJson, VARIAVEIS_EXEMPLO_CONTRATO);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <form action={formAction} className="flex max-w-2xl flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Conteúdo do contrato</Label>
          <EditorTextoCertificado
            ref={editorRef}
            name="conteudo"
            content={defaultValues.conteudo}
            onChangeJson={setConteudoJson}
          />
          {state?.errors?.conteudo && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.conteudo[0]}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="cor_texto" className="text-muted-foreground text-xs">
            Cor do texto
          </Label>
          <Input
            id="cor_texto"
            name="cor_texto"
            type="color"
            className="h-8 w-14 p-1"
            value={corTexto}
            onChange={(e) => setCorTexto(e.target.value)}
          />
          {state?.errors?.cor_texto && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.cor_texto[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs">Variáveis disponíveis</Label>
          <div className="flex flex-wrap gap-1">
            {CONTRATO_VARIAVEIS.map((variavel) => (
              <Button
                key={variavel}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => editorRef.current?.insertText(`{${variavel}}`)}
              >
                {CONTRATO_VARIAVEL_LABELS[variavel]}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Clique numa variável para inserir no ponto onde o cursor está no editor acima.
          </p>
        </div>

        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <SubmitButton />
          {state?.salvo && !state.error && <span className="text-muted-foreground text-sm">Salvo.</span>}
        </div>
      </form>

      <div className="flex-1">
        <Label className="mb-2 block">Prévia (com dados de exemplo)</Label>
        <div className="bg-background rounded-lg border p-8">
          <p className="leading-relaxed whitespace-pre-wrap" style={{ color: corTexto }}>
            {linhasPreview.map((run, indice) => (
              <span
                key={indice}
                className={`${run.negrito ? "font-bold" : ""} ${run.sublinhado ? "underline" : ""}`}
                style={{ fontSize: `${run.tamanhoFonte ?? CONTRATO_TAMANHO_FONTE_PADRAO}px` }}
              >
                {run.texto}
              </span>
            ))}
          </p>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Prévia com dados de exemplo — o contrato real usa os dados do aluno e da matrícula.
        </p>
      </div>
    </div>
  );
}
