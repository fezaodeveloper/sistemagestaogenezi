"use client";

// "use client": estado (nota/comentário selecionados, hover das estrelas), Server Action via
// useTransition, e escuta o evento EVENTO_AULA_CONCLUIDA_ALTERADA (disparado por um componente
// irmão, ToggleAulaConcluidaButton) pra aparecer/sumir sem precisar recarregar a página.

import { useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { salvarAvaliacaoAula } from "@/app/aluno/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/actions";
import { EVENTO_AULA_CONCLUIDA_ALTERADA } from "@/components/aluno/toggle-aula-concluida-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const COMENTARIO_MAX = 500;

export function AulaAvaliacao({
  aulaId,
  avaliacaoInicial,
  concluidaInicial,
}: {
  aulaId: string;
  avaliacaoInicial: { nota: number; comentario: string | null } | null;
  // Só aparece depois que o aluno conclui a aula — ver ToggleAulaConcluidaButton, que dispara
  // EVENTO_AULA_CONCLUIDA_ALTERADA ao marcar/desmarcar (sem esperar reload da página).
  concluidaInicial: boolean;
}) {
  const [mostrar, setMostrar] = useState(concluidaInicial);
  const [nota, setNota] = useState(avaliacaoInicial?.nota ?? 0);
  const [hoverNota, setHoverNota] = useState(0);
  const [comentario, setComentario] = useState(avaliacaoInicial?.comentario ?? "");
  const [jaAvaliou, setJaAvaliou] = useState(avaliacaoInicial !== null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function aoAlterarConclusao(evento: Event) {
      const { concluida } = (evento as CustomEvent<{ concluida: boolean }>).detail;
      setMostrar(concluida);
    }
    window.addEventListener(EVENTO_AULA_CONCLUIDA_ALTERADA, aoAlterarConclusao);
    return () => window.removeEventListener(EVENTO_AULA_CONCLUIDA_ALTERADA, aoAlterarConclusao);
  }, []);

  function salvar(novaNota: number, novoComentario: string) {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await salvarAvaliacaoAula(aulaId, { nota: novaNota, comentario: novoComentario });
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      setJaAvaliou(true);
      setSalvo(true);
    });
  }

  function clicarEstrela(valor: number) {
    setNota(valor);
    // Estrela salva na hora, sem botão — o comentário atual (já digitado ou vazio) vai junto,
    // senão avaliar de novo pela estrela apagaria um comentário já salvo.
    salvar(valor, comentario);
  }

  if (!mostrar) return null;

  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">Como você avalia esta aula?</h2>
        {jaAvaliou && (
          <p className="text-muted-foreground text-xs">Você já avaliou esta aula — clique para alterar.</p>
        )}
      </div>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
        {[1, 2, 3, 4, 5].map((valor) => {
          const preenchida = valor <= (hoverNota || nota);
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={valor === nota}
              aria-label={`${valor} estrela${valor > 1 ? "s" : ""}`}
              disabled={isPending}
              onClick={() => clicarEstrela(valor)}
              onMouseEnter={() => setHoverNota(valor)}
              onMouseLeave={() => setHoverNota(0)}
              className="disabled:pointer-events-none disabled:opacity-50"
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
                  preenchida ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground",
                )}
              />
            </button>
          );
        })}
        {nota > 0 && <span className="text-muted-foreground ml-1 text-sm">{nota}/5</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`comentario-avaliacao-${aulaId}`} className="text-sm font-medium">
          Deixe um comentário (opcional)
        </label>
        <Textarea
          id={`comentario-avaliacao-${aulaId}`}
          value={comentario}
          onChange={(evento) => {
            setComentario(evento.target.value);
            setSalvo(false);
          }}
          maxLength={COMENTARIO_MAX}
          placeholder="O que você achou desta aula?"
          disabled={isPending}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {comentario.length}/{COMENTARIO_MAX}
          </span>
          <div className="flex items-center gap-2">
            {salvo && <span className="text-xs text-emerald-600 dark:text-emerald-400">Salvo ✓</span>}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending || nota === 0}
              onClick={() => salvar(nota, comentario)}
            >
              Enviar comentário
            </Button>
          </div>
        </div>
        {nota === 0 && (
          <p className="text-muted-foreground text-xs">Selecione uma nota antes de comentar.</p>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
    </div>
  );
}
