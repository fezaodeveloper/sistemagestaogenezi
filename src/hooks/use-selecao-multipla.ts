"use client";

import { useMemo, useState } from "react";

// Seleção múltipla das listagens do admin (checkbox por linha + "selecionar
// todos"). `idsVisiveis` é a lista que está na tela agora (já com filtros
// aplicados, e memoizada por quem chama): só o que está visível conta como
// selecionado — um item marcado e depois escondido por um filtro nunca é
// incluído numa exclusão sem o admin enxergá-lo.
export function useSelecaoMultipla(idsVisiveis: readonly string[]) {
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => new Set());

  const selecionados = useMemo(() => idsVisiveis.filter((id) => marcados.has(id)), [idsVisiveis, marcados]);
  const todos = idsVisiveis.length > 0 && selecionados.length === idsVisiveis.length;
  const parcial = selecionados.length > 0 && !todos;

  function alternar(id: string) {
    setMarcados((anterior) => {
      const proximo = new Set(anterior);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  // Cabeçalho: marca todos os visíveis; com todos já marcados, desmarca.
  function alternarTodos() {
    setMarcados(todos ? new Set() : new Set(idsVisiveis));
  }

  function definir(ids: readonly string[]) {
    setMarcados(new Set(ids));
  }

  function limpar() {
    setMarcados(new Set());
  }

  return {
    selecionados,
    marcado: (id: string) => marcados.has(id),
    todos,
    parcial,
    alternar,
    alternarTodos,
    definir,
    limpar,
  };
}
