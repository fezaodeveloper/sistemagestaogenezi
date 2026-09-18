"use client";

// "use client": digitação com busca sob demanda (debounce), lista de
// sugestões e navegação por teclado.

import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { buscarCursos, type CursoBusca } from "@/app/admin/leads/actions";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;

// Combobox de curso: o admin digita e as sugestões vêm da tabela `cursos`
// (ilike por nome, ver buscarCursos). O valor só muda quando uma sugestão é
// escolhida — digitar sem escolher e sair do campo volta pro curso
// selecionado, então nunca sobra um texto que não corresponde a um curso.
export function CursoCombobox({
  id,
  selecionado,
  onSelecionar,
}: {
  id?: string;
  selecionado: CursoBusca | null;
  onSelecionar: (curso: CursoBusca) => void;
}) {
  const listaId = useId();
  const [texto, setTexto] = useState(selecionado?.nome ?? "");
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState<CursoBusca[]>([]);
  const [ativo, setAtivo] = useState(-1);
  const [buscou, setBuscou] = useState(false);
  const [buscando, startBusca] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Descarta resposta atrasada: se o admin continua digitando, só a busca
  // mais recente pode atualizar a lista.
  const ultimaBuscaRef = useRef(0);

  function buscar(termo: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const numero = ++ultimaBuscaRef.current;
      startBusca(async () => {
        const encontrados = await buscarCursos(termo);
        if (numero !== ultimaBuscaRef.current) return;
        setResultados(encontrados);
        setAtivo(encontrados.length > 0 ? 0 : -1);
        setBuscou(true);
      });
    }, DEBOUNCE_MS);
  }

  function handleFocus() {
    setAberto(true);
    // Sem digitar nada, o campo mostra o nome do curso atual — buscar por
    // esse texto só listaria o próprio curso. Abre com as sugestões gerais.
    buscar(texto === selecionado?.nome ? "" : texto);
  }

  function handleChange(valor: string) {
    setTexto(valor);
    setAberto(true);
    buscar(valor);
  }

  function escolher(curso: CursoBusca) {
    setTexto(curso.nome);
    setAberto(false);
    onSelecionar(curso);
  }

  function fechar() {
    setAberto(false);
    // Texto digitado que não virou seleção é descartado.
    setTexto(selecionado?.nome ?? "");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Enter dentro do combobox escolhe a sugestão — nunca envia formulário.
      event.preventDefault();
      if (aberto && ativo >= 0 && resultados[ativo]) escolher(resultados[ativo]);
    } else if (event.key === "Escape") {
      if (aberto) {
        // Evita fechar o Sheet/Dialog que contém o combobox junto.
        event.stopPropagation();
        fechar();
      }
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Digite para buscar um curso..."
        value={texto}
        onFocus={handleFocus}
        onBlur={fechar}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg p-1 shadow-md ring-1"
        >
          {buscando && resultados.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">Buscando...</li>
          )}
          {!buscando && buscou && resultados.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">Nenhum curso encontrado.</li>
          )}
          {resultados.map((curso, indice) => (
            <li
              key={curso.id}
              role="option"
              aria-selected={curso.id === selecionado?.id}
              // onMouseDown (não onClick) + preventDefault: o clique numa
              // sugestão não pode tirar o foco do input antes de escolher,
              // senão o onBlur fecha a lista e o clique se perde.
              onMouseDown={(event) => {
                event.preventDefault();
                escolher(curso);
              }}
              onMouseEnter={() => setAtivo(indice)}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-sm ${
                indice === ativo ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              {curso.nome}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
