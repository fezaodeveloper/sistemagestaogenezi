"use client";

// "use client": digitação com busca sob demanda (debounce), lista de
// sugestões e navegação por teclado.

import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;

// Combobox genérico: o admin digita e as sugestões vêm de `buscar` (uma
// Server Action). O valor só muda quando uma sugestão é escolhida — digitar
// sem escolher e sair do campo volta pro item selecionado, então nunca sobra
// um texto que não corresponde a um registro. Mesma mecânica de
// curso-combobox.tsx (leads), generalizada.
export function BuscaCombobox<T extends { id: string }>({
  id,
  selecionado,
  buscar,
  rotulo,
  detalhe,
  placeholder = "Digite para buscar...",
  minimoCaracteres = 2,
  onSelecionar,
}: {
  id?: string;
  selecionado: T | null;
  buscar: (termo: string) => Promise<T[]>;
  rotulo: (item: T) => string;
  detalhe?: (item: T) => string | null;
  placeholder?: string;
  minimoCaracteres?: number;
  onSelecionar: (item: T) => void;
}) {
  const listaId = useId();
  const [texto, setTexto] = useState(selecionado ? rotulo(selecionado) : "");
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState<T[]>([]);
  const [ativo, setAtivo] = useState(-1);
  const [buscou, setBuscou] = useState(false);
  const [buscando, startBusca] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Descarta resposta atrasada: só a busca mais recente atualiza a lista.
  const ultimaBuscaRef = useRef(0);

  function executarBusca(termo: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (termo.trim().length < minimoCaracteres) {
      ultimaBuscaRef.current += 1;
      setResultados([]);
      setBuscou(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const numero = ++ultimaBuscaRef.current;
      startBusca(async () => {
        const encontrados = await buscar(termo);
        if (numero !== ultimaBuscaRef.current) return;
        setResultados(encontrados);
        setAtivo(encontrados.length > 0 ? 0 : -1);
        setBuscou(true);
      });
    }, DEBOUNCE_MS);
  }

  function handleChange(valor: string) {
    setTexto(valor);
    setAberto(true);
    executarBusca(valor);
  }

  function escolher(item: T) {
    setTexto(rotulo(item));
    setAberto(false);
    onSelecionar(item);
  }

  function fechar() {
    setAberto(false);
    // Texto digitado que não virou seleção é descartado.
    setTexto(selecionado ? rotulo(selecionado) : "");
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
      // Enter dentro do combobox escolhe a sugestão — nunca envia o formulário.
      event.preventDefault();
      if (aberto && ativo >= 0 && resultados[ativo]) escolher(resultados[ativo]);
    } else if (event.key === "Escape" && aberto) {
      event.stopPropagation();
      fechar();
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
        placeholder={placeholder}
        value={texto}
        onFocus={(event) => {
          setAberto(true);
          event.currentTarget.select();
        }}
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
          {resultados.length === 0 && !buscando && !buscou && (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">
              Digite ao menos {minimoCaracteres} caracteres para buscar.
            </li>
          )}
          {buscando && resultados.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">Buscando...</li>
          )}
          {!buscando && buscou && resultados.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">Nenhum resultado.</li>
          )}
          {resultados.map((item, indice) => (
            <li
              key={item.id}
              role="option"
              aria-selected={item.id === selecionado?.id}
              // onMouseDown (não onClick) + preventDefault: o clique numa
              // sugestão não pode tirar o foco do input antes de escolher.
              onMouseDown={(event) => {
                event.preventDefault();
                escolher(item);
              }}
              onMouseEnter={() => setAtivo(indice)}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-sm ${
                indice === ativo ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <span className="block">{rotulo(item)}</span>
              {detalhe && detalhe(item) && (
                <span className="text-muted-foreground block text-xs">{detalhe(item)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
