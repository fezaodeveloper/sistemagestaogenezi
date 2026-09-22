"use client";

// "use client": carrega sob demanda (só quando a aba "Execuções" é aberta), filtro por status e
// cancelamento.

import { useEffect, useState, useTransition } from "react";
import { cancelarExecucao, listarExecucoes, type ExecucaoView } from "@/app/admin/whatsapp-fluxos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUSES = ["", "em_andamento", "concluido", "erro", "cancelado"] as const;
const STATUS_LABEL: Record<string, string> = {
  "": "Todos",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  erro: "Erro",
  cancelado: "Cancelado",
};
const STATUS_VARIANTE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  em_andamento: "secondary",
  concluido: "default",
  erro: "destructive",
  cancelado: "outline",
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function WhatsappFluxoExecucoes({ fluxoId }: { fluxoId: string }) {
  const [status, setStatus] = useState<string>("");
  // null = ainda carregando (primeira vez, ou depois de trocar o filtro/cancelar uma execução).
  const [execucoes, setExecucoes] = useState<ExecucaoView[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [cancelando, startCancelar] = useTransition();

  // Busca direto no corpo do effect (sem setState síncrono antes do await) — mesmo padrão de
  // src/hooks/useConquistas.ts: só atualiza estado dentro do .then(), depois que a resposta chega.
  useEffect(() => {
    let cancelado = false;
    listarExecucoes(fluxoId, status || undefined).then((r) => {
      if (cancelado) return;
      if ("error" in r) {
        setErro(r.error);
        setExecucoes([]);
        return;
      }
      setErro(null);
      setExecucoes(r);
    });
    return () => {
      cancelado = true;
    };
  }, [fluxoId, status, versao]);

  function cancelar(id: string) {
    startCancelar(async () => {
      const r = await cancelarExecucao(id);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setVersao((v) => v + 1);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar execuções por status">
        {STATUSES.map((s) => (
          <button
            key={s || "todos"}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              status === s ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent/50"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {execucoes === null ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : !execucoes || execucoes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">Nenhuma execução ainda.</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {execucoes.map((e) => (
            <li key={e.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {e.telefone}
                      <Badge variant={STATUS_VARIANTE[e.status] ?? "outline"}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {e.entidadeTipo ? `${e.entidadeTipo} · ` : ""}
                      {formatarDataHora(e.createdAt)}
                      {e.noAtual ? ` · nó atual: ${e.noAtual}` : ""}
                    </span>
                    {e.erroDetalhe && <span className="text-destructive text-xs">{e.erroDetalhe}</span>}
                  </div>
                  {e.status === "em_andamento" && (
                    <Button type="button" size="sm" variant="outline" disabled={cancelando} onClick={() => cancelar(e.id)}>
                      Cancelar
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
