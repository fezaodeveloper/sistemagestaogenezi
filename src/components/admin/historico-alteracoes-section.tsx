import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CAMPO_LABELS: Record<string, string> = {
  full_name: "Nome completo",
  status_aluno: "Status do aluno",
  telefone: "Telefone",
  email: "E-mail",
  cpf: "CPF",
  status: "Status da matrícula",
  valor_final: "Valor final",
  data_expiracao: "Data de expiração",
};

function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

type HistoricoRow = {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  alterado_em: string;
  profiles: { full_name: string | null } | null;
};

// Server Component simples (RSC por padrão, sem interatividade) — usado em
// ambas as telas que registram histórico (aluno e matrícula), parametrizado
// só por tabela/registro. Nenhum "vazio" tratado como erro: histórico vazio
// é o estado normal de qualquer registro que nunca foi editado.
export async function HistoricoAlteracoesSection({
  tabela,
  registroId,
}: {
  tabela: "alunos" | "matriculas";
  registroId: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("historico_alteracoes")
    .select(
      "id, campo, valor_anterior, valor_novo, alterado_em, profiles!historico_alteracoes_alterado_por_fkey(full_name)",
    )
    .eq("tabela", tabela)
    .eq("registro_id", registroId)
    .order("alterado_em", { ascending: false })
    .limit(20);

  const historico = (data ?? []) as unknown as HistoricoRow[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de alterações</CardTitle>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma alteração registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>Anterior</TableHead>
                <TableHead>Novo</TableHead>
                <TableHead>Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDataHora(linha.alterado_em)}</TableCell>
                  <TableCell className="text-sm">{CAMPO_LABELS[linha.campo] ?? linha.campo}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{linha.valor_anterior ?? "—"}</TableCell>
                  <TableCell className="text-sm">{linha.valor_novo ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {linha.profiles?.full_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
