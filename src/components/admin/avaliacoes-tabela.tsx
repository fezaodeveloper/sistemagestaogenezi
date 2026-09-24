import { AvaliacaoDetalhesDialog } from "@/components/admin/avaliacao-detalhes-dialog";
import { AvaliacaoEstrelas } from "@/components/admin/avaliacao-estrelas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type LinhaAvaliacaoAula = {
  aulaId: string;
  cursoNome: string;
  moduloNumero: number;
  moduloTitulo: string;
  aulaNumero: number;
  aulaTitulo: string;
  media: number;
  total: number;
  distribuicao: [number, number, number, number, number]; // índice 0 = nota 1 ... índice 4 = nota 5
  ultimaAvaliacao: string;
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Mini barra de distribuição: uma barrinha por nota (1 a 5), altura proporcional à maior
// contagem entre as 5 — dá uma ideia visual rápida do formato da distribuição (concentrada em
// notas altas, bimodal, etc.) sem precisar abrir o dialog de detalhes.
function DistribuicaoMini({ distribuicao }: { distribuicao: LinhaAvaliacaoAula["distribuicao"] }) {
  const max = Math.max(...distribuicao, 1);
  return (
    <div className="flex h-6 items-end gap-0.5" title={distribuicao.map((c, i) => `${i + 1}★: ${c}`).join(" · ")}>
      {distribuicao.map((contagem, indice) => (
        <div
          key={indice}
          className="w-1.5 rounded-sm bg-amber-400/70"
          style={{ height: `${Math.max(8, (contagem / max) * 100)}%` }}
          aria-hidden
        />
      ))}
      <span className="sr-only">
        Distribuição: {distribuicao.map((c, i) => `${c} avaliações com nota ${i + 1}`).join(", ")}
      </span>
    </div>
  );
}

export function AvaliacoesTabela({ linhas }: { linhas: LinhaAvaliacaoAula[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Curso / Módulo / Aula</TableHead>
          <TableHead>Média</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Distribuição</TableHead>
          <TableHead>Última avaliação</TableHead>
          <TableHead>Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha) => (
          <TableRow key={linha.aulaId}>
            <TableCell className="whitespace-normal">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">{linha.cursoNome}</span>
                <span className="font-medium">
                  Módulo {linha.moduloNumero} — Aula {linha.aulaNumero}: {linha.aulaTitulo}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <AvaliacaoEstrelas nota={linha.media} />
                <span>{linha.media.toFixed(1)}</span>
              </div>
            </TableCell>
            <TableCell>{linha.total}</TableCell>
            <TableCell>
              <DistribuicaoMini distribuicao={linha.distribuicao} />
            </TableCell>
            <TableCell>{formatarData(linha.ultimaAvaliacao)}</TableCell>
            <TableCell>
              <AvaliacaoDetalhesDialog
                aulaId={linha.aulaId}
                aulaTitulo={`Módulo ${linha.moduloNumero} — Aula ${linha.aulaNumero}: ${linha.aulaTitulo}`}
                media={linha.media}
                totalAvaliacoes={linha.total}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
