import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Exibição só-leitura de nota em estrelas (arredonda pro inteiro mais próximo pra decidir quantas
// preencher) — usada na tabela de métricas e no dialog de detalhes. Diferente do seletor
// clicável do aluno (src/components/aluno/aula-avaliacao.tsx), que é interativo.
export function AvaliacaoEstrelas({
  nota,
  tamanho = "sm",
}: {
  nota: number;
  tamanho?: "sm" | "md";
}) {
  const arredondada = Math.round(nota);
  const classeIcone = tamanho === "md" ? "size-5" : "size-3.5";

  return (
    <div className="flex items-center gap-0.5" aria-label={`${nota.toFixed(1)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((valor) => (
        <Star
          key={valor}
          className={cn(
            classeIcone,
            valor <= arredondada ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}
