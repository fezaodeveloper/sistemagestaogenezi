import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AtividadeRecenteConecta } from "@/lib/conecta/schema";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ConectaAtividadeRecente({ atividade }: { atividade: AtividadeRecenteConecta }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimas empresas cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {atividade.empresasRecentes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            atividade.empresasRecentes.map((empresa) => (
              <div key={empresa.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{empresa.nome}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{formatDateBR(empresa.createdAt)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimas vagas publicadas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {atividade.vagasRecentes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma vaga publicada ainda.</p>
          ) : (
            atividade.vagasRecentes.map((vaga) => (
              <div key={vaga.id} className="flex flex-col gap-0.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{vaga.titulo}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDateBR(vaga.createdAt)}</span>
                </div>
                <span className="text-muted-foreground text-xs">{vaga.empresaNome}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimos candidatos ativados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {atividade.candidatosAtivadosRecentes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum candidato externo ativado ainda.</p>
          ) : (
            atividade.candidatosAtivadosRecentes.map((candidato) => (
              <div key={candidato.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{candidato.nome}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{formatDateBR(candidato.updatedAt)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
