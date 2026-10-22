import { getHistoricoEnvios } from "@/app/admin/configuracoes/regras-notificacao-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TIPO_LABELS: Record<string, string> = {
  matricula_criada: "Matrícula criada",
  lembrete_aula: "Lembrete de aula",
  falta: "Falta em aula",
  lead_recontato: "Recontato de lead",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  enviado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falha: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
};

function formatDataHora(isoString: string): string {
  const data = new Date(isoString);
  const dataFormatada = data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = data.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${dataFormatada} às ${hora}`;
}

// Server Component: só leitura, sem interatividade — ao contrário de RegrasNotificacaoSection
// (que precisa recarregar depois de criar/editar/excluir no client), este histórico só precisa
// refletir o estado atual a cada carregamento da página.
export async function HistoricoEnviosSection() {
  const historico = await getHistoricoEnvios();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">Enviado hoje</p>
            <p className="text-2xl font-semibold">{historico.totalHoje}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">Enviado na semana</p>
            <p className="text-2xl font-semibold">{historico.totalSemana}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">Enviado no mês</p>
            <p className="text-2xl font-semibold">{historico.totalMes}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(historico.contagemPorTipo).map(([tipo, quantidade]) => (
          <Badge key={tipo} variant="outline">
            {TIPO_LABELS[tipo] ?? tipo}: {quantidade}
          </Badge>
        ))}
        {historico.duplicatasDetectadas > 0 && (
          <Badge className="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            ⚠️ Possível duplicata detectada: {historico.duplicatasDetectadas} caso(s)
          </Badge>
        )}
      </div>

      {historico.ultimos.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Nenhum envio registrado ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historico.ultimos.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell>{TIPO_LABELS[linha.tipo] ?? linha.tipo}</TableCell>
                <TableCell>{linha.destinatario}</TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE_CLASS[linha.status] ?? ""}>{linha.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDataHora(linha.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
