"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { JSONContent } from "@tiptap/react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EditorTextoCertificado,
  type EditorTextoCertificadoHandle,
} from "@/components/admin/editor-texto-certificado";
import { tiptapJsonParaRuns, type TextoRun } from "@/lib/certificados/texto";
import { criarTermo, atualizarTermo, type TermoEditorFormState } from "@/app/admin/termos/actions";
import { TERMO_TIPOS, TERMO_TIPO_LABELS, criarConteudoTermoVazio, type Termo, type TermoTipo } from "@/lib/termos/schema";
import { TERMO_VARIAVEIS, TERMO_VARIAVEL_LABELS, VARIAVEIS_EXEMPLO_TERMO } from "@/lib/termos/variaveis";

// Tamanho de fonte da prévia quando nenhum tamanho é aplicado no editor —
// mesmo valor usado em ContratoTemplateForm (corpo de documento comum, não
// um certificado decorativo de página inteira).
const TERMO_TAMANHO_FONTE_PADRAO = 14;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

// Mesmo componente de prévia A4 usado em ContratoTemplateForm — duplicado
// aqui (não extraído pra um componente compartilhado) porque as duas telas
// vivem em módulos independentes e a duplicação é pequena (um único bloco).
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
    <div className={cn("relative mx-auto w-full bg-white shadow-md ring-1 ring-black/10", className)} style={{ aspectRatio: "210 / 297" }}>
      <div className="absolute inset-0 overflow-y-auto p-10">
        <p className="leading-relaxed whitespace-pre-wrap" style={{ color: corTexto }}>
          {linhasPreview.map((run, indice) => (
            <span
              key={indice}
              className={`${run.negrito ? "font-bold" : ""} ${run.sublinhado ? "underline" : ""}`}
              style={{ fontSize: `${run.tamanhoFonte ?? TERMO_TAMANHO_FONTE_PADRAO}px` }}
            >
              {run.texto}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export function TermoEditorForm({ termo }: { termo?: Termo }) {
  const action = termo ? atualizarTermo.bind(null, termo.id) : criarTermo;
  const [state, formAction] = useActionState<TermoEditorFormState, FormData>(action, undefined);

  const editorRef = useRef<EditorTextoCertificadoHandle>(null);
  const [tipo, setTipo] = useState<TermoTipo | "">(termo?.tipo ?? "");
  const [ativo, setAtivo] = useState(termo?.ativo ?? true);
  const [conteudoJson, setConteudoJson] = useState<JSONContent>(termo?.conteudo_json ?? criarConteudoTermoVazio());
  const [corTexto, setCorTexto] = useState(termo?.cor_texto ?? "#000000");
  const [telaCheiaAberta, setTelaCheiaAberta] = useState(false);

  const linhasPreview = tiptapJsonParaRuns(conteudoJson, VARIAVEIS_EXEMPLO_TERMO);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <form action={formAction} className="flex max-w-2xl flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" name="titulo" defaultValue={termo?.titulo} required />
          {state?.errors?.titulo && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.titulo[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" items={TERMO_TIPO_LABELS} value={tipo} onValueChange={(value) => setTipo(value as TermoTipo)}>
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TERMO_TIPOS.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {TERMO_TIPO_LABELS[opcao]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state?.errors?.tipo && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.tipo[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Conteúdo</Label>
          <EditorTextoCertificado
            ref={editorRef}
            name="conteudo_json"
            content={conteudoJson}
            onChangeJson={setConteudoJson}
          />
          {state?.errors?.conteudo_json && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.conteudo_json[0]}
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
            onChange={(event) => setCorTexto(event.target.value)}
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
            {TERMO_VARIAVEIS.map((variavel) => (
              <Button
                key={variavel}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => editorRef.current?.insertText(`{${variavel}}`)}
              >
                {TERMO_VARIAVEL_LABELS[variavel]}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Clique numa variável para inserir no ponto onde o cursor está no editor acima.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ativo" className="font-normal">
            Ativo
          </Label>
          <Switch id="ativo" name="ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <SubmitButton />
          <Button type="button" variant="outline" render={<Link href="/admin/termos" />} nativeButton={false}>
            Cancelar
          </Button>
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

        <p className="text-muted-foreground mt-2 text-xs">Prévia com dados de exemplo.</p>
      </div>

      <Dialog open={telaCheiaAberta} onOpenChange={setTelaCheiaAberta}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prévia do termo</DialogTitle>
          </DialogHeader>
          <A4Preview linhasPreview={linhasPreview} corTexto={corTexto} className="max-w-175" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
