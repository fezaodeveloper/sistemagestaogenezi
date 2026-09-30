"use client";

// "use client": Selects navegam via router.push a cada mudança (mesmo padrão de
// avaliacoes-filtros.tsx) — nenhum <select> nativo submeteria um form GET sozinho com o visual
// do Base UI Select. A busca por aluno é um input de texto simples, só navega no submit.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PERIODO_ITEMS: Record<string, string> = {
  "30": "Últimos 30 dias",
  "7": "Últimos 7 dias",
  "90": "Últimos 90 dias",
  todos: "Todo o período",
};

const STATUS_ITEMS: Record<string, string> = {
  todos: "Todos os status",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export type FiltrosResultados = {
  aba: "quiz" | "prova";
  cursoId: string;
  status: string;
  periodo: string;
  aluno: string;
};

function construirUrl(base: string, filtros: FiltrosResultados): string {
  const params = new URLSearchParams();
  params.set("aba", filtros.aba);
  if (filtros.cursoId !== "todos") params.set("curso", filtros.cursoId);
  if (filtros.status !== "todos") params.set("status", filtros.status);
  if (filtros.periodo !== "30") params.set("periodo", filtros.periodo);
  if (filtros.aluno) params.set("aluno", filtros.aluno);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function ResultadosFiltros({
  filtros,
  cursos,
  baseUrl,
}: {
  filtros: FiltrosResultados;
  cursos: { id: string; nome: string }[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [buscaAluno, setBuscaAluno] = useState(filtros.aluno);
  const cursoItems: Record<string, string> = {
    todos: "Todos os cursos",
    ...Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome])),
  };

  function atualizar(campo: keyof FiltrosResultados, valor: string | null) {
    if (valor === null) return;
    router.push(construirUrl(baseUrl, { ...filtros, [campo]: valor }));
  }

  function buscarAluno(evento: React.FormEvent) {
    evento.preventDefault();
    router.push(construirUrl(baseUrl, { ...filtros, aluno: buscaAluno.trim() }));
  }

  const temFiltroAtivo =
    filtros.cursoId !== "todos" || filtros.status !== "todos" || filtros.periodo !== "30" || filtros.aluno !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select items={cursoItems} value={filtros.cursoId} onValueChange={(v) => atualizar("cursoId", v)}>
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

      <Select items={STATUS_ITEMS} value={filtros.status} onValueChange={(v) => atualizar("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_ITEMS).map(([valor, rotulo]) => (
            <SelectItem key={valor} value={valor}>
              {rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={PERIODO_ITEMS} value={filtros.periodo} onValueChange={(v) => atualizar("periodo", v)}>
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

      <form onSubmit={buscarAluno} className="flex items-center gap-1">
        <Input
          value={buscaAluno}
          onChange={(evento) => setBuscaAluno(evento.target.value)}
          placeholder="Buscar por aluno..."
          className="w-44"
          aria-label="Buscar por aluno"
        />
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {temFiltroAtivo && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setBuscaAluno("");
            router.push(`${baseUrl}?aba=${filtros.aba}`);
          }}
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
