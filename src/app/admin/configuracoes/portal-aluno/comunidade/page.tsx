import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import {
  COLUNAS_CATEGORIA,
  contarPostsPorCategoria,
  paraCategoriaView,
  resolverAutores,
} from "@/lib/comunidade/dados";
import { COMUNIDADE_STATUS_LABEL, ICONE_PADRAO, isComunidadeStatus, type ComunidadeStatus } from "@/lib/comunidade/tipos";
import { ComunidadeAvisoForm } from "@/components/admin/comunidade-aviso-form";
import { ComunidadeCategoriasManager } from "@/components/admin/comunidade-categorias-manager";
import { ComunidadeConfigForm } from "@/components/admin/comunidade-config-form";
import { ComunidadePostAdminCard, type PostAdminView } from "@/components/admin/comunidade-post-admin-card";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";

const BASE_URL = "/admin/configuracoes/portal-aluno/comunidade";

type SearchParams = { status?: string; page?: string; limit?: string };

type LinhaPost = {
  id: string;
  autor_id: string;
  titulo: string;
  conteudo: string;
  status: string;
  fixado: boolean;
  total_respostas: number;
  total_curtidas: number;
  created_at: string;
  comunidade_categorias: { nome: string; icone: string | null } | null;
};

function hrefAba(status: ComunidadeStatus | null): string {
  return status ? `${BASE_URL}?status=${status}` : BASE_URL;
}

export default async function PortalAlunoComunidadePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");

  const sp = await searchParams;
  const status: ComunidadeStatus | null = isComunidadeStatus(sp.status) ? sp.status : null;
  const limite = parseLimite(sp.limit);
  const pagina = parsePagina(sp.page);

  const supabase = await createClient();

  let consulta = supabase
    .from("comunidade_posts")
    .select("id, autor_id, titulo, conteudo, status, fixado, total_respostas, total_curtidas, created_at, comunidade_categorias(nome, icone)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(calcularOffset(pagina, limite), calcularOffset(pagina, limite) + limite - 1);
  if (status) consulta = consulta.eq("status", status);

  const [configResult, categoriasResult, resumoResult, postsResult] = await Promise.all([
    supabase.from("configuracoes").select("portal_comunidade_ativo, portal_comunidade_alunos_excluem").eq("id", true).maybeSingle(),
    supabase.from("comunidade_categorias").select(COLUNAS_CATEGORIA).order("ordem").order("nome"),
    supabase.rpc("comunidade_resumo"),
    consulta,
  ]);

  const migrationPendente = !!configResult.error || !!categoriasResult.error;

  const linhasCategorias = (categoriasResult.data ?? []) as Parameters<typeof paraCategoriaView>[0][];
  const totais = await contarPostsPorCategoria(
    supabase,
    linhasCategorias.map((l) => l.id),
  );
  const categorias = linhasCategorias.map((l) => paraCategoriaView(l, totais.get(l.id) ?? 0));

  const resumo = (resumoResult.data as { total_posts: number; total_respostas: number; membros_ativos: number }[] | null)?.[0];

  const linhasPosts = (postsResult.data ?? []) as unknown as LinhaPost[];
  const autores = await resolverAutores(
    linhasPosts.map((l) => l.autor_id),
    undefined,
    { nomeCompleto: true },
  );
  const posts: PostAdminView[] = linhasPosts.map((l) => ({
    id: l.id,
    titulo: l.titulo,
    conteudo: l.conteudo,
    categoria: `${l.comunidade_categorias?.icone?.trim() || ICONE_PADRAO} ${l.comunidade_categorias?.nome ?? "Categoria"}`,
    autorNome: autores.get(l.autor_id)?.nome ?? "Aluno",
    autorEquipe: autores.get(l.autor_id)?.equipe ?? false,
    status: isComunidadeStatus(l.status) ? l.status : "ativo",
    fixado: l.fixado,
    totalRespostas: l.total_respostas,
    totalCurtidas: l.total_curtidas,
    createdAt: l.created_at,
  }));
  const totalPosts = postsResult.count ?? 0;

  const cartoes: { rotulo: string; valor: number | null }[] = [
    { rotulo: "Posts", valor: resumo?.total_posts ?? null },
    { rotulo: "Respostas", valor: resumo?.total_respostas ?? null },
    { rotulo: "Membros ativos (30 dias)", valor: resumo?.membros_ativos ?? null },
  ];

  const abas: (ComunidadeStatus | null)[] = [null, "ativo", "oculto", "removido"];
  const paramsPaginacao: Record<string, string> = {};
  if (status) paramsPaginacao.status = status;
  if (sp.limit) paramsPaginacao.limit = String(limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Comunidade</h2>
        <p className="text-muted-foreground text-sm">Fórum dos alunos: ative o recurso, organize as categorias e modere as postagens.</p>
      </div>

      {migrationPendente && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler os dados da comunidade (a migration <code>comunidade</code> já foi aplicada?).
        </p>
      )}

      <ComunidadeConfigForm
        ativoInicial={configResult.data?.portal_comunidade_ativo === true}
        alunosExcluemInicial={configResult.data?.portal_comunidade_alunos_excluem !== false}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cartoes.map((c) => (
          <Card key={c.rotulo}>
            <CardContent className="flex flex-col gap-1 py-4">
              <span className="text-muted-foreground text-xs">{c.rotulo}</span>
              <span className="text-2xl font-semibold">{c.valor ?? "—"}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <ComunidadeCategoriasManager key={JSON.stringify(categorias)} categorias={categorias} />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">Publicar como equipe</h3>
          <p className="text-muted-foreground text-sm">Avisos e comunicados aparecem com o selo &quot;Equipe&quot;.</p>
        </div>
        <ComunidadeAvisoForm
          categorias={categorias
            .filter((c) => c.ativo)
            .map((c) => ({ id: c.id, nome: c.nome, icone: c.icone, somenteAdmin: c.somenteAdmin }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">Posts recentes</h3>
          <p className="text-muted-foreground text-sm">Fixe, oculte ou remova postagens; expanda para ver e moderar as respostas.</p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por status">
          {abas.map((aba) => {
            const ativa = aba === status;
            return (
              <Link
                key={aba ?? "todos"}
                href={hrefAba(aba)}
                role="tab"
                aria-selected={ativa}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  ativa ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent/50"
                }`}
              >
                {aba ? `${COMUNIDADE_STATUS_LABEL[aba]}s` : "Todos"}
              </Link>
            );
          })}
        </div>

        {postsResult.error ? (
          <Card>
            <CardContent className="text-destructive py-8 text-center text-sm">
              Não foi possível carregar os posts. Tente recarregar a página.
            </CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              {status
                ? `Nenhum post ${COMUNIDADE_STATUS_LABEL[status].toLowerCase()}.`
                : "Nenhum post ainda. Quando os alunos publicarem, eles aparecem aqui."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {posts.map((p) => (
                <ComunidadePostAdminCard key={p.id} post={p} />
              ))}
            </div>
            <Paginacao
              paginaAtual={pagina}
              totalPaginas={calcularTotalPaginas(totalPosts, limite)}
              totalRegistros={totalPosts}
              limite={limite}
              baseUrl={BASE_URL}
              searchParams={paramsPaginacao}
            />
          </>
        )}
      </div>
    </div>
  );
}
