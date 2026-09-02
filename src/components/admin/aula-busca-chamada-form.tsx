"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AulaOpcaoBusca = { id: string; titulo: string; moduloNome: string | null };

// Passo 1 de "Nova chamada" (src/app/admin/turmas/[id]/presencas/registrar/page.tsx)
// — trocou o <Select> suspenso (todas as aulas do curso de uma vez) por
// busca com debounce + sugestões, mesmo padrão da Etapa 1/2 do wizard de
// matrícula (matricula-wizard.tsx). A lista de aulas do curso já vem
// inteira do Server Component (é naturalmente pequena, escopada a um único
// curso) — o debounce aqui só evita filtrar a cada tecla, não evita uma
// ida ao servidor.
export function AulaBuscaChamadaForm({
  turmaId,
  aulas,
}: {
  turmaId: string;
  aulas: AulaOpcaoBusca[];
}) {
  const [busca, setBusca] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
  const [selecionada, setSelecionada] = useState<AulaOpcaoBusca | null>(null);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTermoDebounced(busca.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [busca]);

  const sugestoes =
    termoDebounced.length < 2
      ? []
      : aulas
          .filter((aula) => {
            const titulo = aula.titulo.toLowerCase();
            const modulo = (aula.moduloNome ?? "").toLowerCase();
            return titulo.includes(termoDebounced) || modulo.includes(termoDebounced);
          })
          .slice(0, 10);

  function handleSelecionar(aula: AulaOpcaoBusca) {
    setSelecionada(aula);
    setBusca("");
    setSugestoesAbertas(false);
  }

  function handleLimpar() {
    setSelecionada(null);
    setBusca("");
  }

  return (
    <form
      action={`/admin/turmas/${turmaId}/presencas/registrar`}
      className="flex max-w-xl flex-wrap items-end gap-3"
    >
      <div className="relative flex flex-col gap-2">
        <Label htmlFor="busca_aula">Aula</Label>

        {selecionada ? (
          <Badge variant="secondary" className="flex w-fit items-center gap-1.5 py-1.5 pr-1.5 pl-2.5">
            {selecionada.titulo}
            <button
              type="button"
              onClick={handleLimpar}
              className="hover:bg-muted-foreground/20 rounded-full p-0.5"
              aria-label="Limpar aula selecionada"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ) : (
          <Input
            id="busca_aula"
            placeholder="Buscar aula..."
            className="w-64"
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
              setSugestoesAbertas(true);
            }}
            onFocus={() => setSugestoesAbertas(true)}
            onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
          />
        )}

        <input type="hidden" name="aulaId" value={selecionada?.id ?? ""} />

        {sugestoesAbertas && !selecionada && termoDebounced.length >= 2 && (
          <div className="bg-popover absolute top-full left-0 z-10 mt-1 flex w-64 flex-col overflow-hidden rounded-md border shadow-md">
            {sugestoes.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">Nenhuma aula encontrada.</p>
            ) : (
              sugestoes.map((aula) => (
                <button
                  key={aula.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelecionar(aula);
                  }}
                  className="hover:bg-muted flex flex-col gap-0.5 border-b p-2.5 text-left text-sm last:border-b-0"
                >
                  <span className="font-medium">{aula.titulo}</span>
                  <span className="text-muted-foreground text-xs">{aula.moduloNome ?? "—"}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="data">Data</Label>
        <Input
          id="data"
          name="data"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      <Button type="submit" disabled={!selecionada}>
        Continuar
      </Button>
    </form>
  );
}
