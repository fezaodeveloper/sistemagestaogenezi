"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { listarDetalhesTentativa, type DetalheQuestao } from "@/app/admin/academico/resultados/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TIPO_LABELS: Record<DetalheQuestao["tipo"], string> = {
  multipla_escolha: "Múltipla escolha",
  verdadeiro_falso: "Verdadeiro ou falso",
  dissertativa: "Dissertativa",
};

export function ResultadoDetalhesDialog({
  tipo,
  tentativaId,
  titulo,
  nota,
  aprovado,
}: {
  tipo: "quiz" | "prova";
  tentativaId: string;
  titulo: string;
  nota: number;
  aprovado: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [questoes, setQuestoes] = useState<DetalheQuestao[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    const resultado = await listarDetalhesTentativa(tipo, tentativaId);
    if ("erro" in resultado) {
      setErro(resultado.erro);
    } else {
      setQuestoes(resultado.questoes);
    }
    setCarregouUmaVez(true);
    setCarregando(false);
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        setAberto(open);
        if (open && !carregouUmaVez) void carregar();
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Eye />
            Ver detalhes
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{nota}%</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              aprovado
                ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
            )}
          >
            {aprovado ? "Aprovado" : "Reprovado"}
          </span>
        </div>

        {erro ? (
          <p className="text-destructive py-6 text-center text-sm">{erro}</p>
        ) : carregando && !carregouUmaVez ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Carregando…</p>
        ) : questoes.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhuma questão encontrada.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {questoes.map((questao, indice) => (
              <div key={questao.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {indice + 1}. {questao.enunciado}
                  </p>
                  <span className="text-muted-foreground shrink-0 text-xs">{TIPO_LABELS[questao.tipo]}</span>
                </div>

                <p className="text-sm">
                  <span className="text-muted-foreground">Resposta do aluno: </span>
                  {questao.respostaAlunoTexto || <span className="text-muted-foreground italic">Não respondeu</span>}
                </p>

                {questao.tipo !== "dissertativa" && (
                  <>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Gabarito: </span>
                      {questao.gabaritoTexto ?? "—"}
                    </p>
                    <span
                      className={cn(
                        "w-fit rounded-full px-2 py-0.5 text-xs font-medium",
                        questao.correta
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                          : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
                      )}
                    >
                      {questao.correta ? "Correta" : "Incorreta"}
                    </span>
                  </>
                )}
                {questao.tipo === "dissertativa" && (
                  <p className="text-muted-foreground text-xs">Dissertativa — sem correção automática.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
