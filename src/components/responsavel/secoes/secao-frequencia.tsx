import type { DadosPortalMatricula } from "@/app/responsavel/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  STATUS_PRESENCA_BADGE,
  STATUS_PRESENCA_LABELS,
  corBarraFrequencia,
  corFrequencia,
  formatDataBR,
  formatMesAno,
} from "@/lib/responsavel/formatacao";

type LinhaMes = { chave: string; label: string; aulas: number; presentes: number; faltas: number };

function agruparPorMes(presencas: DadosPortalMatricula["presencas"]): LinhaMes[] {
  const porMes = new Map<string, LinhaMes>();
  for (const presenca of presencas) {
    const chave = presenca.data.slice(0, 7);
    if (!porMes.has(chave)) {
      porMes.set(chave, { chave, label: formatMesAno(presenca.data), aulas: 0, presentes: 0, faltas: 0 });
    }
    const linha = porMes.get(chave)!;
    linha.aulas += 1;
    if (presenca.status === "presente" || presenca.status === "reposicao") linha.presentes += 1;
    if (presenca.status === "falta") linha.faltas += 1;
  }
  return Array.from(porMes.values()).sort((a, b) => b.chave.localeCompare(a.chave));
}

export function SecaoFrequencia({ matricula }: { matricula: DadosPortalMatricula }) {
  const { frequencia, presencas } = matricula;

  if (frequencia.totalAulas === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequência</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Nenhuma presença registrada ainda.
        </CardContent>
      </Card>
    );
  }

  const percentual = Math.round((frequencia.presentes / frequencia.totalAulas) * 100);
  const faltas = presencas.filter((p) => p.status === "falta").length;
  const justificadas = presencas.filter((p) => p.status === "justificada").length;
  const reposicoes = presencas.filter((p) => p.status === "reposicao").length;
  const historicoMensal = agruparPorMes(presencas);
  const ocorrencias = presencas.filter((p) => p.status !== "presente");

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequência geral</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-semibold ${corFrequencia(percentual)}`}>{percentual}%</span>
            <span className="text-muted-foreground text-sm">
              {frequencia.presentes} presenças em {frequencia.totalAulas} aulas
            </span>
          </div>
          <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
            <div className={`h-full rounded-full transition-all ${corBarraFrequencia(percentual)}`} style={{ width: `${percentual}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Faltas</span>
              <span className="text-lg font-semibold">{faltas}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Justificadas</span>
              <span className="text-lg font-semibold">{justificadas}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Reposições</span>
              <span className="text-lg font-semibold">{reposicoes}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Total de aulas</span>
              <span className="text-lg font-semibold">{frequencia.totalAulas}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Aulas</TableHead>
                <TableHead>Presenças</TableHead>
                <TableHead>Faltas</TableHead>
                <TableHead className="text-right">% do mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoMensal.map((linha) => {
                const percentualMes = Math.round((linha.presentes / linha.aulas) * 100);
                return (
                  <TableRow key={linha.chave}>
                    <TableCell className="capitalize">{linha.label}</TableCell>
                    <TableCell>{linha.aulas}</TableCell>
                    <TableCell>{linha.presentes}</TableCell>
                    <TableCell>{linha.faltas}</TableCell>
                    <TableCell className={`text-right font-medium ${corFrequencia(percentualMes)}`}>
                      {percentualMes}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faltas e reposições</CardTitle>
        </CardHeader>
        <CardContent>
          {ocorrencias.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Nenhuma falta registrada. 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ocorrencias.map((ocorrencia) => (
                  <TableRow key={ocorrencia.id}>
                    <TableCell>{formatDataBR(ocorrencia.data)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_PRESENCA_BADGE[ocorrencia.status] ?? ""}>
                        {STATUS_PRESENCA_LABELS[ocorrencia.status] ?? ocorrencia.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ocorrencia.status === "reposicao" && ocorrencia.dataReposicao
                        ? `Reposta em ${formatDataBR(ocorrencia.dataReposicao)}`
                        : ocorrencia.justificativa || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
