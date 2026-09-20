"use client";

// "use client": textarea controlado com camada de destaque sincronizada no scroll.

import { useRef, type ReactNode, type UIEvent } from "react";

// Destaque de sintaxe SIMPLES: tags HTML em azul, placeholders {variavel} e blocos
// {#se x}...{/se} em âmbar. Técnica de "backdrop": uma <pre> colorida por trás de um
// <textarea> de texto transparente (mesma fonte, mesmo espaçamento e quebra de linha
// — por isso as classes são compartilhadas — e o scroll é sincronizado).

const TOKEN = /(<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|\{#se\s+\w+\}|\{\/se\}|\{\w+\})/g;

function destacar(texto: string): ReactNode[] {
  return texto.split(TOKEN).map((parte, indice) => {
    if (!parte) return null;
    if (parte.startsWith("<!--")) return <span key={indice} className="text-muted-foreground italic">{parte}</span>;
    if (parte.startsWith("<")) return <span key={indice} className="text-sky-600 dark:text-sky-400">{parte}</span>;
    if (parte.startsWith("{")) return <span key={indice} className="rounded-sm bg-amber-500/15 font-medium text-amber-700 dark:text-amber-400">{parte}</span>;
    return <span key={indice}>{parte}</span>;
  });
}

const CLASSES_COMUNS = "font-mono text-xs leading-5 p-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]";

export function EditorHtmlSimples({
  id,
  value,
  onChange,
  linhas = 16,
}: {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  linhas?: number;
}) {
  const camadaRef = useRef<HTMLPreElement>(null);
  const altura = `${linhas * 1.25 + 1.5}rem`;

  function sincronizar(evento: UIEvent<HTMLTextAreaElement>) {
    if (camadaRef.current) {
      camadaRef.current.scrollTop = evento.currentTarget.scrollTop;
      camadaRef.current.scrollLeft = evento.currentTarget.scrollLeft;
    }
  }

  return (
    <div className="border-input bg-background relative overflow-hidden rounded-md border" style={{ height: altura }}>
      <pre
        ref={camadaRef}
        aria-hidden
        className={`${CLASSES_COMUNS} pointer-events-none absolute inset-0 m-0 overflow-hidden`}
      >
        {destacar(value)}
        {/* Uma linha extra: o textarea sempre reserva espaço após a última quebra. */}
        {"\n"}
      </pre>
      <textarea
        id={id}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        onScroll={sincronizar}
        spellCheck={false}
        wrap="soft"
        className={`${CLASSES_COMUNS} caret-foreground selection:bg-primary/20 absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent outline-none`}
      />
    </div>
  );
}
