"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import type { AlunoElegivelChat } from "@/lib/chat/chat";

// Trocou o <Select> suspenso (todos os alunos elegíveis de uma vez) por
// busca com debounce + sugestões, mesmo padrão de
// aula-busca-chamada-form.tsx e da Etapa 1/2 do wizard de matrícula
// (matricula-wizard.tsx). A lista de alunos elegíveis já vem inteira do
// Server Component — o debounce aqui só evita filtrar a cada tecla.
export function NovaConversaSelect({ alunos }: { alunos: AlunoElegivelChat[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
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
      : alunos
          .filter((aluno) => {
            const nome = (aluno.nome ?? "").toLowerCase();
            const email = (aluno.email ?? "").toLowerCase();
            return nome.includes(termoDebounced) || email.includes(termoDebounced);
          })
          .slice(0, 10);

  if (alunos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum aluno com matrícula ativa em curso presencial ou híbrido no momento.
      </p>
    );
  }

  return (
    <div className="relative flex max-w-sm flex-col gap-2">
      <Input
        placeholder="Buscar aluno..."
        value={busca}
        onChange={(event) => {
          setBusca(event.target.value);
          setSugestoesAbertas(true);
        }}
        onFocus={() => setSugestoesAbertas(true)}
        onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
      />

      {sugestoesAbertas && termoDebounced.length >= 2 && (
        <div className="bg-popover absolute top-full left-0 z-10 mt-1 flex w-full flex-col overflow-hidden rounded-md border shadow-md">
          {sugestoes.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">Nenhum aluno encontrado.</p>
          ) : (
            sugestoes.map((aluno) => (
              <button
                key={aluno.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  router.push(`/admin/chat/${aluno.id}`);
                }}
                className="hover:bg-muted flex flex-col gap-0.5 border-b p-2.5 text-left text-sm last:border-b-0"
              >
                <span className="font-medium">{aluno.nome ?? "Aluno"}</span>
                <span className="text-muted-foreground text-xs">{aluno.email ?? "—"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
