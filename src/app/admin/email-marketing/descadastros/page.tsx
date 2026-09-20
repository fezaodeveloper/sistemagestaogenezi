import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { DescadastroRemoverButton } from "@/components/admin/descadastro-remover-button";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LinhaDescadastro = {
  id: string;
  email: string;
  motivo: string | null;
  created_at: string;
  alunos: { full_name: string | null } | null;
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default async function DescadastrosPage({ searchParams }: { searchParams: Promise<{ page?: string; limit?: string }> }) {
  await requireRole("admin");
  const { page, limit } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("email_descadastros")
    .select("id, email, motivo, created_at, alunos(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);

  const linhas = (data ?? []) as unknown as LinhaDescadastro[];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/email-marketing" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          E-mail Marketing
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Descadastros</h1>
            <p className="text-muted-foreground text-sm">
              Pessoas que pediram para não receber e-mails de marketing. Elas ficam de fora de todas as campanhas (LGPD).
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums">{total}</p>
            <p className="text-muted-foreground text-xs">descadastrado{total === 1 ? "" : "s"} no total</p>
          </div>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar a lista (a migration <code>email_descadastros</code> já foi aplicada?).
          </CardContent>
        </Card>
      ) : linhas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">Ninguém se descadastrou até agora.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Descadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell className="font-medium">{linha.email}</TableCell>
                  <TableCell>{linha.alunos?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate text-xs" title={linha.motivo ?? undefined}>
                    {linha.motivo ?? "—"}
                  </TableCell>
                  <TableCell>{formatarDataHora(linha.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <DescadastroRemoverButton id={linha.id} email={linha.email} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={calcularTotalPaginas(total, limite)}
        totalRegistros={total}
        limite={limite}
        baseUrl="/admin/email-marketing/descadastros"
        searchParams={{}}
      />
    </div>
  );
}
