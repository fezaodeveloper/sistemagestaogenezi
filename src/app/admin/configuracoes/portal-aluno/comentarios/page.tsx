import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { COMENTARIO_STATUS_LABEL, isComentarioStatus, type ComentarioStatus } from "@/lib/comentarios/tipos";
import { ComentariosConfigForm } from "@/components/admin/comentarios-config-form";
import { ComentarioAdminCard, type ComentarioAdminView } from "@/components/admin/comentario-admin-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";

const BASE_URL = "/admin/configuracoes/portal-aluno/comentarios";
const MAX_IDS_BUSCA = 200;

type SearchParams = { status?: string; q?: string; page?: string; limit?: string };

type Linha = {
  id: string;
  aluno_id: string;
  texto: string;
  status: string;
  resposta_admin: string | null;
  respondido_at: string | null;
  created_at: string;
  aulas: { numero: number; titulo: string } | null;
};

// Tira o que tem significado na gramática de filtros do PostgREST/ILIKE (vírgula, parênteses,
// %, _, \) — a busca é por texto simples.
function limparBusca(valor: string | undefined): string {
  return (valor ?? "").replace(/[%_,()\\*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function hrefAba(status: string | null, q: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `${BASE_URL}?${query}` : BASE_URL;
}

export default async function PortalAlunoComentariosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");

  const sp = await searchParams;
  const status: ComentarioStatus | null = isComentarioStatus(sp.status) ? sp.status : null;
  const q = limparBusca(sp.q);
  const limite = parseLimite(sp.limit);
  const pagina = parsePagina(sp.page);

  const supabase = await createClient();

  const contar = (s: ComentarioStatus | null) => {
    let query = supabase.from("aula_comentarios").select("id", { count: "exact", head: true });
    if (s) query = query.eq("status", s);
    return query;
  };

  // Busca por aluno OU aula: resolve primeiro os ids que casam e filtra os comentários por eles.
  let filtroBusca: string | null = null;
  let buscaSemResultado = false;
  if (q) {
    const [{ data: perfis }, { data: aulas }] = await Promise.all([
      supabase.from("profiles").select("id").ilike("full_name", `%${q}%`).limit(MAX_IDS_BUSCA),
      supabase.from("aulas").select("id").ilike("titulo", `%${q}%`).limit(MAX_IDS_BUSCA),
    ]);
    const alunoIds = (perfis ?? []).map((p) => p.id as string);
    const aulaIds = (aulas ?? []).map((a) => a.id as string);
    const partes: string[] = [];
    if (alunoIds.length) partes.push(`aluno_id.in.(${alunoIds.join(",")})`);
    if (aulaIds.length) partes.push(`aula_id.in.(${aulaIds.join(",")})`);
    if (partes.length) filtroBusca = partes.join(",");
    else buscaSemResultado = true;
  }

  let consulta = supabase
    .from("aula_comentarios")
    .select("id, aluno_id, texto, status, resposta_admin, respondido_at, created_at, aulas(numero, titulo)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(calcularOffset(pagina, limite), calcularOffset(pagina, limite) + limite - 1);
  if (status) consulta = consulta.eq("status", status);
  if (filtroBusca) consulta = consulta.or(filtroBusca);

  const [configResult, resultado, total, pendentes, aprovados, rejeitados] = await Promise.all([
    supabase.from("configuracoes").select("portal_comentarios_ativo, portal_comentarios_moderacao").maybeSingle(),
    buscaSemResultado ? Promise.resolve({ data: [] as Linha[], count: 0, error: null }) : consulta,
    contar(null),
    contar("pendente"),
    contar("aprovado"),
    contar("rejeitado"),
  ]);

  const migrationPendente = !!configResult.error || !!total.error;
  const linhas = ((resultado.data ?? []) as unknown as Linha[]) ?? [];
  const totalFiltrado = resultado.count ?? 0;

  // Nomes dos alunos (uma consulta só pelos ids da página).
  const nomes = new Map<string, string>();
  const alunoIds = Array.from(new Set(linhas.map((l) => l.aluno_id)));
  if (alunoIds.length) {
    const { data: perfis } = await supabase.from("profiles").select("id, full_name").in("id", alunoIds);
    for (const p of (perfis ?? []) as { id: string; full_name: string | null }[]) nomes.set(p.id, p.full_name?.trim() ?? "");
  }

  const comentarios: ComentarioAdminView[] = linhas.map((l) => ({
    id: l.id,
    alunoNome: nomes.get(l.aluno_id) || "Aluno",
    aulaTitulo: l.aulas ? `Aula ${l.aulas.numero} — ${l.aulas.titulo}` : "Aula removida",
    createdAt: l.created_at,
    texto: l.texto,
    status: isComentarioStatus(l.status) ? l.status : "pendente",
    respostaAdmin: l.resposta_admin,
    respondidoAt: l.respondido_at,
  }));

  const abas: { valor: ComentarioStatus | null; rotulo: string; contagem: number }[] = [
    { valor: null, rotulo: "Todos", contagem: total.count ?? 0 },
    { valor: "pendente", rotulo: "Pendentes", contagem: pendentes.count ?? 0 },
    { valor: "aprovado", rotulo: "Aprovados", contagem: aprovados.count ?? 0 },
    { valor: "rejeitado", rotulo: "Rejeitados", contagem: rejeitados.count ?? 0 },
  ];

  const paramsPaginacao: Record<string, string> = {};
  if (status) paramsPaginacao.status = status;
  if (q) paramsPaginacao.q = q;
  if (sp.limit) paramsPaginacao.limit = String(limite);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Comentários</h2>
        <p className="text-muted-foreground text-sm">Ative os comentários nas aulas e modere o que os alunos escrevem.</p>
      </div>

      {migrationPendente && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler os comentários (a migration <code>aula_comentarios</code> já foi aplicada?).
        </p>
      )}

      <ComentariosConfigForm
        ativoInicial={configResult.data?.portal_comentarios_ativo === true}
        moderacaoInicial={configResult.data?.portal_comentarios_moderacao !== false}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por status">
          {abas.map((aba) => {
            const ativa = aba.valor === status;
            return (
              <Link
                key={aba.rotulo}
                href={hrefAba(aba.valor, q)}
                role="tab"
                aria-selected={ativa}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  ativa ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent/50"
                }`}
              >
                {aba.rotulo}
                {aba.valor === "pendente" && aba.contagem > 0 ? (
                  <Badge variant="destructive">{aba.contagem}</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">{aba.contagem}</span>
                )}
              </Link>
            );
          })}
        </div>

        <form method="get" action={BASE_URL} className="flex flex-wrap gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q} placeholder="Buscar por aluno ou aula..." className="max-w-sm" aria-label="Buscar comentários" />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
          {q && (
            <Button render={<Link href={hrefAba(status, "")} />} nativeButton={false} variant="ghost">
              Limpar
            </Button>
          )}
        </form>
      </div>

      {resultado.error ? (
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            Não foi possível carregar os comentários. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : comentarios.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {q || status
              ? `Nenhum comentário ${status ? COMENTARIO_STATUS_LABEL[status].toLowerCase() : ""} encontrado${q ? ` para "${q}"` : ""}.`
              : "Nenhum comentário ainda. Quando os alunos comentarem nas aulas, eles aparecem aqui."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {comentarios.map((c) => (
              <ComentarioAdminCard key={c.id} comentario={c} />
            ))}
          </div>
          <Paginacao
            paginaAtual={pagina}
            totalPaginas={calcularTotalPaginas(totalFiltrado, limite)}
            totalRegistros={totalFiltrado}
            limite={limite}
            baseUrl={BASE_URL}
            searchParams={paramsPaginacao}
          />
        </>
      )}
    </div>
  );
}
