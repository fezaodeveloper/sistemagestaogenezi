"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ChecklistItem } from "@/lib/campanhas/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// TAREFA PARTE 5 — componente puro/controlado (sem fetch/save próprio): usado tanto no
// formulário de criar/editar (serializado num input hidden, salvo junto do resto via
// "Salvar alterações") quanto na visão de detalhes (com autosave debounced em volta, ver
// ComoFazerChecklistAutosave).
export function ComoFazerChecklist({
  itens,
  onChange,
}: {
  itens: ChecklistItem[];
  onChange: (itens: ChecklistItem[]) => void;
}) {
  function alternar(indice: number) {
    onChange(itens.map((item, i) => (i === indice ? { ...item, feito: !item.feito } : item)));
  }

  function editarTexto(indice: number, texto: string) {
    onChange(itens.map((item, i) => (i === indice ? { ...item, texto } : item)));
  }

  function remover(indice: number) {
    onChange(itens.filter((_, i) => i !== indice));
  }

  function adicionar() {
    onChange([...itens, { texto: "", feito: false }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {itens.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma tarefa ainda.</p>}
      {itens.map((item, indice) => (
        <div key={indice} className="flex items-center gap-2">
          <Checkbox checked={item.feito} onCheckedChange={() => alternar(indice)} />
          <Input
            value={item.texto}
            onChange={(event) => editarTexto(indice, event.target.value)}
            className={item.feito ? "text-muted-foreground line-through" : undefined}
            placeholder="Descreva a tarefa"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remover tarefa"
            onClick={() => remover(indice)}
          >
            <Trash2 className="text-destructive size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={adicionar}>
        <Plus />
        Adicionar tarefa
      </Button>
    </div>
  );
}
