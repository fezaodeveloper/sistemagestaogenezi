"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buscarGlobal, type BuscaGlobalResultado } from "@/app/admin/actions";

const RESULTADO_VAZIO: BuscaGlobalResultado = { alunos: [], matriculas: [], cursos: [] };

export function BuscaGlobal() {
  const [query, setQuery] = useState("");
  const [resultado, setResultado] = useState<BuscaGlobalResultado>(RESULTADO_VAZIO);
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  function aoDigitar(valor: string) {
    setQuery(valor);
    // Abaixo de 3 caracteres é reação direta à digitação, não uma
    // sincronização com sistema externo — fica fora do useEffect (ver
    // react-hooks/set-state-in-effect) e é resolvido aqui mesmo, no handler.
    if (valor.trim().length < 3) {
      setResultado(RESULTADO_VAZIO);
      setAberto(false);
    }
  }

  // Debounce de 300ms — só chama a Server Action depois que o usuário para
  // de digitar por esse intervalo, evitando uma chamada por tecla.
  useEffect(() => {
    if (query.trim().length < 3) return;

    const timer = setTimeout(() => {
      startTransition(async () => {
        const dados = await buscarGlobal(query);
        setResultado(dados);
        setAberto(true);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function aoClicarFora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    function aoPressionarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoPressionarTecla);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoPressionarTecla);
    };
  }, []);

  const temResultados =
    resultado.alunos.length > 0 || resultado.matriculas.length > 0 || resultado.cursos.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={query}
        onChange={(e) => aoDigitar(e.target.value)}
        onFocus={() => {
          if (temResultados) setAberto(true);
        }}
        placeholder="Buscar alunos, matrículas, cursos..."
        className="pl-8"
        aria-label="Busca global"
      />
      {aberto && (
        <div className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full z-50 mt-1 w-full rounded-xl p-3 text-sm shadow-md ring-1">
          {isPending ? (
            <p className="text-muted-foreground px-1 py-2">Buscando...</p>
          ) : !temResultados ? (
            <p className="text-muted-foreground px-1 py-2">Nenhum resultado encontrado.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {resultado.alunos.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 px-1 text-xs font-semibold tracking-wider uppercase">
                    Alunos
                  </p>
                  <div className="flex flex-col">
                    {resultado.alunos.map((aluno) => (
                      <Link
                        key={aluno.id}
                        href="/admin/alunos"
                        onClick={() => setAberto(false)}
                        className="hover:bg-accent/50 flex flex-col rounded-md px-2 py-1.5 transition-colors"
                      >
                        <span className="font-medium">{aluno.nome}</span>
                        <span className="text-muted-foreground text-xs">
                          {aluno.email} · {aluno.cpf}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {resultado.matriculas.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 px-1 text-xs font-semibold tracking-wider uppercase">
                    Matrículas
                  </p>
                  <div className="flex flex-col">
                    {resultado.matriculas.map((matricula) => (
                      <Link
                        key={matricula.id}
                        href={`/admin/matriculas/${matricula.id}`}
                        onClick={() => setAberto(false)}
                        className="hover:bg-accent/50 flex flex-col rounded-md px-2 py-1.5 transition-colors"
                      >
                        <span className="font-medium">{matricula.alunoNome}</span>
                        <span className="text-muted-foreground text-xs">{matricula.cursoNome}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {resultado.cursos.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 px-1 text-xs font-semibold tracking-wider uppercase">
                    Cursos
                  </p>
                  <div className="flex flex-col">
                    {resultado.cursos.map((curso) => (
                      <Link
                        key={curso.id}
                        href={`/admin/cursos/${curso.id}/editar`}
                        onClick={() => setAberto(false)}
                        className="hover:bg-accent/50 flex flex-col rounded-md px-2 py-1.5 transition-colors"
                      >
                        <span className="font-medium">{curso.nome}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
