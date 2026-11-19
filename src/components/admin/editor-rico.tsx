"use client";

// "use client": contenteditable + execCommand só funcionam no navegador.

import { useEffect, useRef } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// MELHORIA 1 (edição rica das descrições de campanha) — sem dependência externa de propósito:
// contenteditable + document.execCommand (API antiga, mas ainda funcional nos navegadores
// comuns pra bold/italic/align) + um pós-processamento manual pro tamanho de fonte (execCommand
// "fontSize" só aceita 1-7 e gera <font size="N">, não CSS de verdade — troca isso por
// <span style="font-size:...">, que é o que de fato queremos salvar/sanitizar). O valor salvo é
// sempre o innerHTML atual da div — sanitizado de novo na exibição pública, nunca confiado aqui.
const TAMANHOS_FONTE: Record<string, string> = {
  pequeno: "12px",
  normal: "14px",
  grande: "18px",
  "muito-grande": "24px",
};
const TAMANHO_ITEMS: Record<string, string> = {
  pequeno: "Pequeno",
  normal: "Normal",
  grande: "Grande",
  "muito-grande": "Muito grande",
};

export function EditorRico({
  id,
  value,
  onChange,
  linhas = 3,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  linhas?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Guarda o último valor que O PRÓPRIO editor gerou — só sincroniza o DOM a partir da prop
  // `value` quando ela muda por uma fonte EXTERNA (trocar de etapa, carregar outro registro),
  // nunca a cada tecla digitada (perderia a posição do cursor).
  const ultimoValorProprioRef = useRef(value);

  useEffect(() => {
    if (ref.current && value !== ultimoValorProprioRef.current) {
      ref.current.innerHTML = value;
      ultimoValorProprioRef.current = value;
    }
  }, [value]);

  function dispararChange() {
    const html = ref.current?.innerHTML ?? "";
    ultimoValorProprioRef.current = html;
    onChange(html);
  }

  function exec(comando: string, argumento?: string) {
    ref.current?.focus();
    document.execCommand(comando, false, argumento);
    dispararChange();
  }

  function aplicarTamanho(tamanho: string) {
    if (!ref.current || !tamanho) return;
    ref.current.focus();
    // "7" como valor-sentinela: nenhum outro tamanho usado aqui gera esse marcador, então dá
    // pra achar com certeza só os <font> recém-criados por este comando.
    document.execCommand("fontSize", false, "7");
    const marcados = ref.current.querySelectorAll('font[size="7"]');
    marcados.forEach((no) => {
      const span = document.createElement("span");
      span.style.fontSize = TAMANHOS_FONTE[tamanho] ?? TAMANHOS_FONTE.normal;
      span.innerHTML = no.innerHTML;
      no.replaceWith(span);
    });
    dispararChange();
  }

  function handleKeyDown(evento: React.KeyboardEvent<HTMLDivElement>) {
    // Garante Shift+Enter -> <br> explícito (Enter sozinho already cria um novo bloco/parágrafo
    // via comportamento padrão do contenteditable, que não precisa de ajuda aqui).
    if (evento.key === "Enter" && evento.shiftKey) {
      evento.preventDefault();
      document.execCommand("insertHTML", false, "<br>");
      dispararChange();
    }
  }

  return (
    <div className="border-input bg-background overflow-hidden rounded-md border">
      <div className="bg-muted/40 flex flex-wrap items-center gap-1 border-b p-1.5">
        <Button type="button" variant="ghost" size="icon-sm" title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          <Bold className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
          <Italic className="size-3.5" />
        </Button>
        <div className="bg-border mx-1 h-5 w-px" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Alinhar à esquerda"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("justifyLeft")}
        >
          <AlignLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Centralizar"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("justifyCenter")}
        >
          <AlignCenter className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Alinhar à direita"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("justifyRight")}
        >
          <AlignRight className="size-3.5" />
        </Button>
        <div className="bg-border mx-1 h-5 w-px" />
        <Select items={TAMANHO_ITEMS} defaultValue={null} onValueChange={(valor) => valor && aplicarTamanho(valor)}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Tamanho da fonte" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TAMANHO_ITEMS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        id={id}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={dispararChange}
        onKeyDown={handleKeyDown}
        onBlur={dispararChange}
        data-placeholder={placeholder}
        style={{ minHeight: `${linhas * 1.5}rem` }}
        className="text-muted-foreground empty:before:content-[attr(data-placeholder)] p-3 text-sm leading-relaxed outline-none **:max-w-full [&:not(:empty)]:text-foreground"
      />
    </div>
  );
}
