"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Bold, Underline as UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FontSize } from "@/lib/certificados/tiptap-font-size";
import { cn } from "@/lib/utils";

const TAMANHOS_FONTE = ["12", "14", "16", "18", "24", "32", "36", "40", "48", "56", "64", "72", "80", "90", "100"];
const TAMANHO_FONTE_LABELS = Object.fromEntries(TAMANHOS_FONTE.map((t) => [t, `${t}px`]));

// Editor headless — toolbar montada com Button/Select do shadcn (sem
// CSS/UI própria do Tiptap pra brigar contra o tema). Marcação limitada a
// negrito/sublinhado/tamanho de fonte (o que foi pedido); StarterKit traz
// mais marks de graça, mas o toolbar só expõe essas.
export type EditorTextoCertificadoHandle = {
  // Insere texto no ponto atual do cursor — usado pelo botão "Inserir"
  // da lista de variáveis do contrato (ver ContratoTemplateForm).
  insertText: (texto: string) => void;
};

export const EditorTextoCertificado = forwardRef<
  EditorTextoCertificadoHandle,
  {
    name: string;
    content: JSONContent;
    onChangeJson?: (json: JSONContent) => void;
  }
>(function EditorTextoCertificado({ name, content, onChangeJson }, ref) {
  const [json, setJson] = useState<JSONContent>(content);
  const [, forcarAtualizacao] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, FontSize],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const novoJson = editor.getJSON();
      setJson(novoJson);
      onChangeJson?.(novoJson);
    },
    onSelectionUpdate: () => forcarAtualizacao((n) => n + 1),
  });

  useImperativeHandle(
    ref,
    () => ({
      insertText: (texto: string) => {
        editor?.chain().focus().insertContent(texto).run();
      },
    }),
    [editor],
  );

  const tamanhoAtual = (editor?.getAttributes("textStyle").fontSize as string | undefined)
    ?.replace("px", "");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("bold") && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-label="Negrito"
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("underline") && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          aria-label="Sublinhado"
        >
          <UnderlineIcon className="size-4" />
        </Button>
        <Select
          items={TAMANHO_FONTE_LABELS}
          value={tamanhoAtual ?? ""}
          onValueChange={(v) => editor?.chain().focus().setFontSize(`${v}px`).run()}
        >
          <SelectTrigger size="sm" className="w-20" aria-label="Tamanho da fonte">
            <SelectValue placeholder="Tam." />
          </SelectTrigger>
          <SelectContent>
            {TAMANHOS_FONTE.map((tamanho) => (
              <SelectItem key={tamanho} value={tamanho}>
                {tamanho}px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <EditorContent
        editor={editor}
        className="certificado-editor-texto [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:rounded-lg [&_.ProseMirror]:border [&_.ProseMirror]:border-input [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-1"
      />
      <input type="hidden" name={name} value={JSON.stringify(json)} />
    </div>
  );
});
