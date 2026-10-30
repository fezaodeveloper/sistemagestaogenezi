import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parsePagina } from "@/lib/paginacao";
import {
  CAMPANHA_STATUS_CLASSES,
  CAMPANHA_STATUS_LABELS,
  SEGMENTO_LABELS,
  isCampanhaEmailStatus,
  isSegmentoEmail,
} from "@/lib/email/marketing-tipos";
import { EmailCampanhaAcoes } from "@/components/admin/email-campanha-acoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// A tela continua o envio em rodadas de ~50s (ver EmailCampanhaAcoes): cada rodada é
// uma Server Action desta página, então o limite de duração dela vale aqui.
export const maxDuration = 60;

const POR_PAGINA = 25;

type LinhaEnvio = {
  id: string;
  email: string;
  nome: string | null;
  status: string;
  erro: string | null;
  enviado_at: string | null;
};

const ENVIO_STATUSES = ["enviado", "pendente", "erro"] as const;
type EnvioStatus = (typeof ENVIO_STATUSES)[number];

function isEnvioStatus(valor: unknown): valor is EnvioStatus {
  return typeof valor === "string" && (ENVIO_STATUSES as readonly string[]).includes(valor);
}

const ENVIO_CLASSES: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  enviado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  erro: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};
const ENVIO_LABELS: Record<string, string> = { pendente: "Pendente", enviado: "Enviado", erro: "Erro" };

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default async function CampanhaEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { page, status: statusParam } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const filtroEnvio = isEnvioStatus(statusParam) ? statusParam : null;

  const supabase = await createClient();
  const { data: campanha } = await supabase
    .from("email_campanhas_marketing")
    .select("id, nome, assunto, segmento, status, agendada_para, total_destinatarios, total_enviados, total_erros, created_at, cursos(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!campanha) notFound();

  const status = isCampanhaEmailStatus(campanha.status) ? campanha.status : "rascunho";
  if (status === "rascunho" || status === "agendada") redirect(`/admin/email-marketing/${id}/editar`);

  const paginaAtual = parsePagina(page);
  const offset = calcularOffset(paginaAtual, POR_PAGINA);
  let consultaEnvios = supabase
    .from("email_campanhas_envios")
    .select("id, email, nome, status, erro, enviado_at", { count: "exact" })
    .eq("campanha_id", id);
  if (filtroEnvio) consultaEnvios = consultaEnvios.eq("status", filtroEnvio);

  const [{ data: envios, count }, { count: pendentes }] = await Promise.all([
    consultaEnvios.order("created_at").order("id").range(offset, offset + POR_PAGINA - 1),
    supabase.from("email_campanhas_envios").select("id", { count: "exact", head: true }).eq("campanha_id", id).eq("status", "pendente"),
  ]);

  const total = campanha.total_destinatarios as number;
  const enviados = campanha.total_enviados as number;
  const erros = campanha.total_erros as number;
  const cursoNome = (campanha.cursos as unknown as { nome: string } | null)?.nome;
  const progresso = total > 0 ? Math.round(((enviados + erros) / total) * 100) : 0;
  // enviados e erros são contadores mutuamente exclusivos (cada envio termina em um dos dois,
  // nunca nos dois) — taxa de entrega é enviados / (enviados + erros), não "enviados - erros"
  // (que já seria o próprio total_enviados, sem subtrair nada de fato).
  const taxaEntrega = enviados + erros > 0 ? Math.round((enviados / (enviados + erros)) * 100) : null;

  const cartoes = [
    { rotulo: "Destinatários", valor: total },
    { rotulo: "✅ Entregues", valor: enviados, cor: "text-green-600 dark:text-green-400" },
    { rotulo: "❌ Falhas", valor: erros, cor: erros > 0 ? "text-red-600 dark:text-red-400" : "" },
    { rotulo: "📊 Taxa de entrega", valor: taxaEntrega === null ? "—" : `${taxaEntrega}%` },
    { rotulo: "Pendentes", valor: pendentes ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/email-marketing" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          E-mail Marketing
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{campanha.nome as string}</h1>
              <Badge className={CAMPANHA_STATUS_CLASSES[status]}>{CAMPANHA_STATUS_LABELS[status]}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Assunto: {campanha.assunto as string} · {isSegmentoEmail(campanha.segmento) ? SEGMENTO_LABELS[campanha.segmento] : campanha.segmento}
              {cursoNome ? ` (${cursoNome})` : ""} · criada em {formatarDataHora(campanha.created_at as string)}
            </p>
          </div>
          <EmailCampanhaAcoes id={id} nome={campanha.nome as string} status={status} pendentes={pendentes ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cartoes.map((cartao) => (
          <Card key={cartao.rotulo}>
            <CardContent className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium uppercase">{cartao.rotulo}</span>
              <span className={`text-3xl font-semibold tabular-nums ${cartao.cor ?? ""}`}>{cartao.valor}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {status === "enviando" && (
        <div className="flex flex-col gap-1.5">
          <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}>
            <div className="bg-primary h-full transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-muted-foreground text-xs">
            {progresso}% processado. Fechando esta página, o envio continua na próxima execução automática (diária).
          </p>
        </div>
      )}
      {status === "cancelada" && (pendentes ?? 0) > 0 && (
        <p className="text-muted-foreground text-sm">Envio cancelado: {pendentes} destinatário(s) não receberam.</p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status do envio">
        <Button size="sm" variant={filtroEnvio === null ? "secondary" : "outline"} render={<Link href={`/admin/email-marketing/${id}`} />} nativeButton={false}>
          Todos
        </Button>
        {ENVIO_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filtroEnvio === s ? "secondary" : "outline"}
            render={<Link href={`/admin/email-marketing/${id}?status=${s}`} />}
            nativeButton={false}
          >
            {ENVIO_LABELS[s]}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {((envios ?? []) as LinhaEnvio[]).map((envio) => (
              <TableRow key={envio.id}>
                <TableCell className="font-medium">{envio.email}</TableCell>
                <TableCell>{envio.nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={ENVIO_CLASSES[envio.status] ?? ""}>{ENVIO_LABELS[envio.status] ?? envio.status}</Badge>
                </TableCell>
                <TableCell>{envio.enviado_at ? formatarDataHora(envio.enviado_at) : "—"}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate text-xs" title={envio.erro ?? undefined}>
                  {envio.erro ?? ""}
                </TableCell>
              </TableRow>
            ))}
            {(envios ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                  {filtroEnvio ? "Nenhum envio com esse status." : "Nenhum envio registrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={calcularTotalPaginas(count ?? 0, POR_PAGINA)}
        totalRegistros={count ?? 0}
        limite={POR_PAGINA}
        baseUrl={`/admin/email-marketing/${id}`}
        searchParams={filtroEnvio ? { status: filtroEnvio } : {}}
      />
    </div>
  );
}
