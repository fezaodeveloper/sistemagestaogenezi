import { ResultadoDetalhesDialog } from "@/components/admin/resultado-detalhes-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type LinhaResultado = {
  tentativaId: string;
  alunoNome: string;
  cursoNome: string;
  moduloNumero: number;
  itemTitulo: string; // título do quiz (com "Aula N —" na frente) ou da prova
  acertos: number;
  totalObjetivas: number;
  nota: number; // 0-100, calculado pelo banco (criar_tentativa_quiz/prova)
  aprovado: boolean;
  createdAt: string;
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ResultadosTabela({ tipo, linhas }: { tipo: "quiz" | "prova"; linhas: LinhaResultado[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Curso / Módulo / {tipo === "quiz" ? "Quiz" : "Prova"}</TableHead>
          <TableHead>Nota obtida / máxima</TableHead>
          <TableHead>% de acerto</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha) => (
          <TableRow key={linha.tentativaId}>
            <TableCell className="whitespace-normal font-medium">{linha.alunoNome}</TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">{linha.cursoNome}</span>
                <span>
                  Módulo {linha.moduloNumero} — {linha.itemTitulo}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {linha.totalObjetivas > 0 ? `${linha.acertos}/${linha.totalObjetivas}` : "—"}
            </TableCell>
            <TableCell>{linha.nota}%</TableCell>
            <TableCell>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                  linha.aprovado
                    ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                    : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
                )}
              >
                {linha.aprovado ? "Aprovado" : "Reprovado"}
              </span>
            </TableCell>
            <TableCell>{formatarData(linha.createdAt)}</TableCell>
            <TableCell>
              <ResultadoDetalhesDialog
                tipo={tipo}
                tentativaId={linha.tentativaId}
                titulo={`${linha.alunoNome} — Módulo ${linha.moduloNumero}: ${linha.itemTitulo}`}
                nota={linha.nota}
                aprovado={linha.aprovado}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
