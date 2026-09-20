import Link from "next/link";
import { MailX, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import {
  CAMPANHA_STATUSES,
  CAMPANHA_STATUS_CLASSES,
  CAMPANHA_STATUS_LABELS,
  SEGMENTO_LABELS,
  isCampanhaEmailStatus,
  isSegmentoEmail,
} from "@/lib/email/marketing-tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LinhaCampanha = {
  id: string;
  nome: string;
  segmento: string;
  status: string;
  agendada_para: string | null;
  total_destinatarios: number;
  total_enviados: number;
  total_erros: number;
  created_at: string;
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default async function EmailMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; limit?: string }>;
}) {
  await requireRole("admin");
  const { status: statusParam, page, limit } = await searchParams;
  const filtro = isCampanhaEmailStatus(statusParam) ? statusParam : null;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const supabase = await createClient();
  let consulta = supabase
    .from("email_campanhas_marketing")
    .select("id, nome, segmento, status, agendada_para, total_destinatarios, total_enviados, total_erros, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);
  if (filtro) consulta = consulta.eq("status", filtro);

  const [{ data, error, count }, { count: totalDescadastros }] = await Promise.all([
    consulta,
    supabase.from("email_descadastros").select("id", { count: "exact", head: true }),
  ]);
  const campanhas = (data ?? []) as LinhaCampanha[];
  const totalRegistros = count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">E-mail Marketing</h1>
          <p className="text-muted-foreground text-sm">
            Campanhas de e-mail para os alunos, pelo provedor configurado em Configurações &gt; E-mail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/email-marketing/descadastros" />} nativeButton={false}>
            <MailX />
            Descadastros{typeof totalDescadastros === "number" ? ` (${totalDescadastros})` : ""}
          </Button>
          <Button render={<Link href="/admin/email-marketing/nova" />} nativeButton={false}>
            <Plus />
            Nova campanha
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
        <Button size="sm" variant={filtro === null ? "secondary" : "outline"} render={<Link href="/admin/email-marketing" />} nativeButton={false}>
          Todas
        </Button>
        {CAMPANHA_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filtro === status ? "secondary" : "outline"}
            render={<Link href={`/admin/email-marketing?status=${status}`} />}
            nativeButton={false}
          >
            {CAMPANHA_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as campanhas (a migration <code>email_marketing</code> já foi aplicada?).
          </CardContent>
        </Card>
      ) : campanhas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              {filtro ? "Nenhuma campanha com esse status." : "Nenhuma campanha criada ainda."}
            </p>
            {!filtro && (
              <Button render={<Link href="/admin/email-marketing/nova" />} nativeButton={false} variant="outline">
                <Plus />
                Criar a primeira campanha
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Erros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map((campanha) => {
                const status = isCampanhaEmailStatus(campanha.status) ? campanha.status : "rascunho";
                // Rascunho/agendada abrem o editor; as demais, o resumo dos envios.
                const href =
                  status === "rascunho" || status === "agendada"
                    ? `/admin/email-marketing/${campanha.id}/editar`
                    : `/admin/email-marketing/${campanha.id}`;
                return (
                  <TableRow key={campanha.id}>
                    <TableCell>
                      <Link href={href} className="font-medium hover:underline">
                        {campanha.nome}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {isSegmentoEmail(campanha.segmento) ? SEGMENTO_LABELS[campanha.segmento] : campanha.segmento}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={CAMPANHA_STATUS_CLASSES[status]}>{CAMPANHA_STATUS_LABELS[status]}</Badge>
                      {status === "agendada" && campanha.agendada_para && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{formatarDataHora(campanha.agendada_para)}</p>
                      )}
                    </TableCell>
                    <TableCell>{formatarDataHora(campanha.created_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{campanha.total_destinatarios}</TableCell>
                    <TableCell className="text-right tabular-nums">{campanha.total_enviados}</TableCell>
                    <TableCell className={`text-right tabular-nums ${campanha.total_erros > 0 ? "text-destructive font-medium" : ""}`}>
                      {campanha.total_erros}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={calcularTotalPaginas(totalRegistros, limite)}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/email-marketing"
        searchParams={filtro ? { status: filtro } : {}}
      />
    </div>
  );
}
