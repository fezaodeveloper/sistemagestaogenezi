"use client";

import { useState, useTransition } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { salvarTermoLegal } from "@/app/admin/legal/actions";
import type { TermoLegalChave } from "@/lib/termos-legais/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Mesma família de extensões já usada em EditorTextoCertificado (Tiptap
// já instalado no projeto, sem novo pacote) — aqui com toolbar mais
// completa (títulos, listas, citação) porque o conteúdo é texto corrido de
// página legal, não um bloco curto de certificado/contrato. Saída em HTML
// (editor.getHTML()), não JSON — as páginas do aluno renderizam esse HTML
// direto com prose styling, diferente do fluxo de runs pro PDF.
export function TermoLegalEditor({
  chave,
  titulo,
  conteudoInicial,
  atualizadoEm,
  atualizadoPorNome,
}: {
  chave: TermoLegalChave;
  titulo: string;
  conteudoInicial: string;
  atualizadoEm: string;
  atualizadoPorNome: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: conteudoInicial,
    immediatelyRender: false,
    onUpdate: () => {
      setSalvo(false);
    },
  });

  function handleSalvar() {
    if (!editor) return;
    setError(null);
    setSalvo(false);

    startTransition(async () => {
      const resultado = await salvarTermoLegal(chave, editor.getHTML());
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Editando: {titulo}</h1>
        <p className="text-muted-foreground text-sm">
          Última atualização: {formatDataHora(atualizadoEm)}
          {atualizadoPorNome ? ` por ${atualizadoPorNome}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1.5">
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
          className={cn(editor?.isActive("italic") && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-label="Itálico"
        >
          <Italic className="size-4" />
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("heading", { level: 2 }) && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Título 2"
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("heading", { level: 3 }) && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Título 3"
        >
          <Heading3 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("bulletList") && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          aria-label="Lista com marcadores"
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("orderedList") && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          aria-label="Lista numerada"
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(editor?.isActive("blockquote") && "bg-accent")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          aria-label="Citação"
        >
          <Quote className="size-4" />
        </Button>
        <div className="bg-border mx-1 h-5 w-px" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor?.chain().focus().undo().run()}
          aria-label="Desfazer"
        >
          <Undo className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor?.chain().focus().redo().run()}
          aria-label="Refazer"
        >
          <Redo className="size-4" />
        </Button>
      </div>

      <EditorContent
        editor={editor}
        className="termo-legal-editor [&_.ProseMirror]:min-h-96 [&_.ProseMirror]:rounded-lg [&_.ProseMirror]:border [&_.ProseMirror]:border-input [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:outline-none [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground"
      />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {salvo && (
        <p className="text-sm text-green-600 dark:text-green-400">Alterações salvas com sucesso.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleSalvar} disabled={isPending || !editor}>
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
        <Button type="button" variant="outline" render={<a href={`/aluno/legal/${chave}`} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
          Visualizar como aluno
        </Button>
      </div>
    </div>
  );
}
