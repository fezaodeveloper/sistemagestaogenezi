"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { JSONContent } from "@tiptap/react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditorTextoCertificado, type EditorTextoCertificadoHandle } from "@/components/admin/editor-texto-certificado";
import { tiptapJsonParaRuns, type TextoRun } from "@/lib/certificados/texto";
import {
  CONTRATO_TIPO_CURSO_LABELS,
  CONTRATO_VARIAVEIS,
  CONTRATO_VARIAVEL_LABELS,
  VARIAVEIS_EXEMPLO_CONTRATO,
  type ContratoTipoCurso,
} from "@/lib/contratos/schema";
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

// Simula uma folha A4 (proporção 210x297mm) — largura responsiva até um
// máximo, altura derivada pela proporção via aspect-ratio; o conteúdo real
// rola dentro da "página" quando é mais longo do que ela (em vez de
// vazar/cortar, já que isso aqui é só uma prévia, não a paginação real do
// PDF gerado por @react-pdf/renderer).
function A4Preview({
  linhasPreview,
  corTexto,
  className,
}: {
  linhasPreview: TextoRun[];
  corTexto: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full bg-white shadow-md ring-1 ring-black/10",
        className,
      )}
      style={{ aspectRatio: "210 / 297" }}
    >
      <div className="absolute inset-0 overflow-y-auto p-10">
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
    </div>
  );
}

function ContratoTemplateTabForm({
  tipoCurso,
  action,
  defaultValues,
}: {
  tipoCurso: ContratoTipoCurso;
  action: (state: ContratoTemplateFormState, formData: FormData) => Promise<ContratoTemplateFormState>;
  defaultValues: { conteudo: JSONContent; cor_texto: string };
}) {
  const [state, formAction] = useActionState<ContratoTemplateFormState, FormData>(action, undefined);
  const editorRef = useRef<EditorTextoCertificadoHandle>(null);
  const [conteudoJson, setConteudoJson] = useState<JSONContent>(defaultValues.conteudo);
  const [corTexto, setCorTexto] = useState(defaultValues.cor_texto);
  const [telaCheiaAberta, setTelaCheiaAberta] = useState(false);

  const linhasPreview = tiptapJsonParaRuns(conteudoJson, VARIAVEIS_EXEMPLO_CONTRATO);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <form action={formAction} className="flex max-w-2xl flex-1 flex-col gap-5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{CONTRATO_TIPO_CURSO_LABELS[tipoCurso]}</Badge>
          <span className="text-muted-foreground text-xs">Editando este modelo de contrato</span>
        </div>

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
          <Label htmlFor={`cor_texto_${tipoCurso}`} className="text-muted-foreground text-xs">
            Cor do texto
          </Label>
          <Input
            id={`cor_texto_${tipoCurso}`}
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
        <div className="mb-2 flex items-center justify-between">
          <Label>Prévia — tamanho aproximado do A4</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setTelaCheiaAberta(true)}>
            <Maximize2 />
            Tela cheia
          </Button>
        </div>

        <A4Preview linhasPreview={linhasPreview} corTexto={corTexto} className="max-w-148.75" />

        <p className="text-muted-foreground mt-2 text-xs">
          Prévia com dados de exemplo — o contrato real usa os dados do aluno e da matrícula.
        </p>
      </div>

      <Dialog open={telaCheiaAberta} onOpenChange={setTelaCheiaAberta}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prévia — {CONTRATO_TIPO_CURSO_LABELS[tipoCurso]}</DialogTitle>
          </DialogHeader>
          <A4Preview linhasPreview={linhasPreview} corTexto={corTexto} className="max-w-175" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ContratoTemplateForm({
  templates,
}: {
  templates: {
    tipoCurso: ContratoTipoCurso;
    action: (state: ContratoTemplateFormState, formData: FormData) => Promise<ContratoTemplateFormState>;
    defaultValues: { conteudo: JSONContent; cor_texto: string };
  }[];
}) {
  return (
    <Tabs defaultValue={templates[0]?.tipoCurso}>
      <TabsList>
        {templates.map((template) => (
          <TabsTrigger key={template.tipoCurso} value={template.tipoCurso}>
            {CONTRATO_TIPO_CURSO_LABELS[template.tipoCurso]}
          </TabsTrigger>
        ))}
      </TabsList>
      {templates.map((template) => (
        <TabsContent key={template.tipoCurso} value={template.tipoCurso}>
          <ContratoTemplateTabForm
            tipoCurso={template.tipoCurso}
            action={template.action}
            defaultValues={template.defaultValues}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
