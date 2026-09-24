"use client";

// "use client": navega (router.push) a cada mudança de filtro — mesmo padrão do Select de
// "por página" em src/components/ui/paginacao.tsx (nenhum <select> nativo submete um form GET
// sozinho com o visual do Base UI Select).

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const BASE_URL = "/admin/academico/avaliacoes";

const PERIODO_ITEMS: Record<string, string> = {
  todos: "Todo o período",
  "7": "Últimos 7 dias",
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
};

const NOTA_ITEMS: Record<string, string> = {
  todas: "Qualquer nota",
  "1": "1 estrela",
  "2": "2 estrelas",
  "3": "3 estrelas",
  "4": "4 estrelas",
  "5": "5 estrelas",
};

export type FiltrosAvaliacoes = {
  cursoId: string;
  notaMin: string;
  notaMax: string;
  periodo: string;
};

export function AvaliacoesFiltros({
  filtros,
  cursos,
}: {
  filtros: FiltrosAvaliacoes;
  cursos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const cursoItems: Record<string, string> = {
    todos: "Todos os cursos",
    ...Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome])),
  };

  function atualizar(campo: keyof FiltrosAvaliacoes, valor: string | null) {
    if (valor === null) return;
    const params = new URLSearchParams();
    const proximos = { ...filtros, [campo]: valor };
    if (proximos.cursoId !== "todos") params.set("curso", proximos.cursoId);
    if (proximos.notaMin !== "todas") params.set("notaMin", proximos.notaMin);
    if (proximos.notaMax !== "todas") params.set("notaMax", proximos.notaMax);
    if (proximos.periodo !== "todos") params.set("periodo", proximos.periodo);
    // Qualquer mudança de filtro volta pra página 1 — a página atual pode não existir mais no
    // resultado filtrado.
    const query = params.toString();
    router.push(query ? `${BASE_URL}?${query}` : BASE_URL);
  }

  const temFiltroAtivo =
    filtros.cursoId !== "todos" || filtros.notaMin !== "todas" || filtros.notaMax !== "todas" || filtros.periodo !== "todos";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select items={cursoItems} value={filtros.cursoId} onValueChange={(valor) => atualizar("cursoId", valor)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(cursoItems).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={NOTA_ITEMS} value={filtros.notaMin} onValueChange={(valor) => atualizar("notaMin", valor)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Nota mínima" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(NOTA_ITEMS).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {valor === "todas" ? "Nota mínima" : rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={NOTA_ITEMS} value={filtros.notaMax} onValueChange={(valor) => atualizar("notaMax", valor)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Nota máxima" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(NOTA_ITEMS).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {valor === "todas" ? "Nota máxima" : rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={PERIODO_ITEMS} value={filtros.periodo} onValueChange={(valor) => atualizar("periodo", valor)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIODO_ITEMS).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {temFiltroAtivo && (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push(BASE_URL)}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
