"use client";

// "use client": busca e seleção múltipla de cursos.

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CursoOpcao = { id: string; nome: string };

// Seleção múltipla de cursos (lista com busca). Nada marcado = "todos".
export function CursosChecklist({
  cursos,
  selecionados,
  onChange,
  textoAjuda,
}: {
  cursos: CursoOpcao[];
  selecionados: Set<string>;
  onChange: (proximo: Set<string>) => void;
  textoAjuda?: string;
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? cursos.filter((curso) => curso.nome.toLowerCase().includes(termo)) : cursos;
  }, [cursos, busca]);

  function alternar(id: string) {
    const proximo = new Set(selecionados);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    onChange(proximo);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Cursos (opcional)</Label>
        <span className="text-muted-foreground text-xs">
          {selecionados.size === 0 ? "Todos os cursos" : `${selecionados.size} selecionado(s)`}
        </span>
      </div>
      <Input placeholder="Buscar curso..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border p-2">
        {cursos.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhum curso cadastrado.</p>
        ) : filtrados.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhum curso encontrado.</p>
        ) : (
          filtrados.map((curso) => (
            <label key={curso.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selecionados.has(curso.id)} onCheckedChange={() => alternar(curso.id)} />
              {curso.nome}
            </label>
          ))
        )}
      </div>
      {textoAjuda && <p className="text-muted-foreground text-xs">{textoAjuda}</p>}
    </div>
  );
}
