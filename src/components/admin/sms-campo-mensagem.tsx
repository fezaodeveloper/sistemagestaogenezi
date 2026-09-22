"use client";

// "use client": textarea com contador em tempo real e inserção de placeholder na posição do cursor.

import { useRef } from "react";
import { SMS_LIMITE_CARACTERES } from "@/lib/integrax/texto";
import type { SmsPlaceholder } from "@/lib/integrax/templates";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SmsCampoMensagem({
  id,
  rotulo,
  valor,
  onChange,
  placeholders,
  desabilitado = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  placeholders: SmsPlaceholder[];
  desabilitado?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Insere {chave} onde está o cursor (ou no lugar do trecho selecionado) e devolve o foco.
  function inserir(chave: string) {
    const el = ref.current;
    const token = `{${chave}}`;
    const inicio = el?.selectionStart ?? valor.length;
    const fim = el?.selectionEnd ?? valor.length;
    const novo = `${valor.slice(0, inicio)}${token}${valor.slice(fim)}`;
    if (novo.length > SMS_LIMITE_CARACTERES) return;
    onChange(novo);
    requestAnimationFrame(() => {
      el?.focus();
      const posicao = inicio + token.length;
      el?.setSelectionRange(posicao, posicao);
    });
  }

  const restantes = SMS_LIMITE_CARACTERES - valor.length;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Textarea
        id={id}
        ref={ref}
        value={valor}
        rows={3}
        maxLength={SMS_LIMITE_CARACTERES}
        disabled={desabilitado}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Inserir:</span>
          {placeholders.map((p) => (
            <button
              key={p.chave}
              type="button"
              title={p.descricao}
              disabled={desabilitado}
              // Não deixa o clique roubar o foco/seleção do textarea antes de inserir.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => inserir(p.chave)}
              className="bg-muted hover:bg-accent rounded-md px-2 py-0.5 font-mono text-xs transition-colors disabled:opacity-50"
            >
              {`{${p.chave}}`}
            </button>
          ))}
        </div>
        <span className={`text-xs tabular-nums ${restantes <= 0 ? "text-destructive font-medium" : restantes <= 20 ? "text-amber-600" : "text-muted-foreground"}`}>
          {valor.length}/{SMS_LIMITE_CARACTERES}
        </span>
      </div>
    </div>
  );
}
