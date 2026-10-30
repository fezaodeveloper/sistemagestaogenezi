import type { CandidaturaAluno, CandidaturaStatus } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Cópia pro CANDIDATO é mais suave que CANDIDATURA_STATUS_LABELS/BADGE_CLASS (voltados à
// empresa/admin) — "pendente"/"visualizado" juntos como "Em análise" porque, do ponto de vista
// de quem se candidatou, a distinção entre os dois não importa (TAREFA).
const ALUNO_STATUS_INFO: Record<CandidaturaStatus, { label: string; className: string }> = {
  pendente: { label: "Em análise", className: "bg-muted text-muted-foreground" },
  visualizado: { label: "Em análise", className: "bg-muted text-muted-foreground" },
  contato: {
    label: "Empresa entrou em contato",
    className: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  },
  contratado: {
    label: "✅ Contratado!",
    className: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  },
  rejeitado: {
    label: "Não selecionado desta vez",
    className: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  },
};

export function MinhasCandidaturasConecta({ candidaturas }: { candidaturas: CandidaturaAluno[] }) {
  if (candidaturas.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Minhas candidaturas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {candidaturas.map((candidatura) => {
          const info = ALUNO_STATUS_INFO[candidatura.status];
          return (
            <div
              key={candidatura.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{candidatura.vagaTitulo}</span>
                <span className="text-muted-foreground text-xs">
                  {candidatura.nomeEmpresa} · Candidatou-se em {formatDateBR(candidatura.createdAt)}
                </span>
              </div>
              <Badge className={info.className}>{info.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
