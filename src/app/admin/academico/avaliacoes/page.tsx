import { Star, TrendingDown, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { AvaliacoesFiltros, type FiltrosAvaliacoes } from "@/components/admin/avaliacoes-filtros";
import { AvaliacoesTabela, type LinhaAvaliacaoAula } from "@/components/admin/avaliacoes-tabela";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";

const BASE_URL = "/admin/academico/avaliacoes";

const PERIODO_DIAS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

type SearchParams = { curso?: string; notaMin?: string; notaMax?: string; periodo?: string; page?: string; limit?: string };

type LinhaBruta = {
  aula_id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  aulas: {
    numero: number;
    titulo: string;
    modulo_id: string;
    modulos: {
      numero: number;
      titulo: string;
      curso_id: string;
      cursos: { id: string; nome: string } | null;
    } | null;
  } | null;
};

type AulaAgregada = {
  aulaId: string;
  cursoId: string;
  cursoNome: string;
  moduloNumero: number;
  moduloTitulo: string;
  aulaNumero: number;
  aulaTitulo: string;
  notas: number[];
  ultimaAvaliacao: string;
};

function media(notas: number[]): number {
  return notas.length > 0 ? notas.reduce((soma, n) => soma + n, 0) / notas.length : 0;
}

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("admin");

  const sp = await searchParams;
  const filtros: FiltrosAvaliacoes = {
    cursoId: sp.curso ?? "todos",
    notaMin: sp.notaMin ?? "todas",
    notaMax: sp.notaMax ?? "todas",
    periodo: sp.periodo ?? "todos",
  };
  const pagina = parsePagina(sp.page);
  const limite = parseLimite(sp.limit);

  const supabase = await createClient();

  const [{ data: cursosData }, respostaAvaliacoes] = await Promise.all([
    supabase.from("cursos").select("id, nome").order("nome"),
    (async () => {
      // periodo filtra a JANELA de dados considerada tanto pelos cards do topo quanto pela
      // tabela (um "recorte no tempo" do relatório inteiro); curso e nota mín/máx só filtram a
      // tabela — ver AvaliacoesFiltros. Nunca lança: se a migration de aula_avaliacoes ainda não
      // foi aplicada a tabela não existe e a consulta falha, tratado abaixo como lista vazia.
      let query = supabase
        .from("aula_avaliacoes")
        .select(
          "aula_id, nota, comentario, created_at, aulas(numero, titulo, modulo_id, modulos(numero, titulo, curso_id, cursos(id, nome)))",
        );
      const dias = PERIODO_DIAS[filtros.periodo];
      if (dias) {
        const desde = new Date();
        desde.setDate(desde.getDate() - dias);
        query = query.gte("created_at", desde.toISOString());
      }
      return await query;
    })(),
  ]);

  const cursos = (cursosData ?? []) as { id: string; nome: string }[];
  const migrationPendente = !!respostaAvaliacoes.error;
  const linhasBrutas = ((respostaAvaliacoes.data ?? []) as unknown as LinhaBruta[]) ?? [];

  // Agrega em memória por aula (média, total, distribuição, última avaliação) — GROUP BY não dá
  // pra expressar via PostgREST, e o volume (avaliações de uma escola) é pequeno o bastante pra
  // reduzir em JS em vez de escrever uma function/view SQL só pra isso (mesmo racional de
  // resumo-diario.ts/relatorio-semanal.ts, que já somam valores em memória).
  const porAula = new Map<string, AulaAgregada>();
  for (const linha of linhasBrutas) {
    const aula = linha.aulas;
    const modulo = aula?.modulos;
    const curso = modulo?.cursos;
    if (!aula || !modulo || !curso) continue; // aula/módulo/curso removido — ignora a linha órfã.

    const existente = porAula.get(linha.aula_id);
    if (existente) {
      existente.notas.push(linha.nota);
      if (linha.created_at > existente.ultimaAvaliacao) existente.ultimaAvaliacao = linha.created_at;
    } else {
      porAula.set(linha.aula_id, {
        aulaId: linha.aula_id,
        cursoId: curso.id,
        cursoNome: curso.nome,
        moduloNumero: modulo.numero,
        moduloTitulo: modulo.titulo,
        aulaNumero: aula.numero,
        aulaTitulo: aula.titulo,
        notas: [linha.nota],
        ultimaAvaliacao: linha.created_at,
      });
    }
  }
  const todasAulas = Array.from(porAula.values());

  // Cards de resumo: sempre sobre o período selecionado, mas INDEPENDENTES do filtro de
  // curso/nota da tabela abaixo (painel geral, não deveria "sumir" só porque a tabela está
  // filtrada num curso específico).
  const mediaGeral = media(linhasBrutas.map((l) => l.nota));
  const totalAvaliacoes = linhasBrutas.length;
  const aulasAbaixoDe3 = todasAulas.filter((a) => media(a.notas) < 3).length;
  const melhorAvaliada = todasAulas
    .filter((a) => a.notas.length > 0)
    .sort((a, b) => media(b.notas) - media(a.notas) || b.notas.length - a.notas.length)[0];

  // Filtros da tabela (curso, nota mín/máx sobre a média da aula).
  let linhasFiltradas = todasAulas;
  if (filtros.cursoId !== "todos") {
    linhasFiltradas = linhasFiltradas.filter((a) => a.cursoId === filtros.cursoId);
  }
  if (filtros.notaMin !== "todas") {
    const min = Number(filtros.notaMin);
    linhasFiltradas = linhasFiltradas.filter((a) => media(a.notas) >= min);
  }
  if (filtros.notaMax !== "todas") {
    const max = Number(filtros.notaMax);
    linhasFiltradas = linhasFiltradas.filter((a) => media(a.notas) <= max);
  }

  // Pior média primeiro — o relatório existe pra apontar problema (ver card "atenção" acima);
  // desempate por mais avaliações (mais confiável que uma média de poucas respostas).
  linhasFiltradas = [...linhasFiltradas].sort(
    (a, b) => media(a.notas) - media(b.notas) || b.notas.length - a.notas.length,
  );

  const totalFiltrado = linhasFiltradas.length;
  const totalPaginas = calcularTotalPaginas(totalFiltrado, limite);
  const offset = calcularOffset(pagina, limite);
  const linhasPagina: LinhaAvaliacaoAula[] = linhasFiltradas.slice(offset, offset + limite).map((a) => ({
    aulaId: a.aulaId,
    cursoNome: a.cursoNome,
    moduloNumero: a.moduloNumero,
    moduloTitulo: a.moduloTitulo,
    aulaNumero: a.aulaNumero,
    aulaTitulo: a.aulaTitulo,
    media: media(a.notas),
    total: a.notas.length,
    distribuicao: [1, 2, 3, 4, 5].map((n) => a.notas.filter((nota) => nota === n).length) as LinhaAvaliacaoAula["distribuicao"],
    ultimaAvaliacao: a.ultimaAvaliacao,
  }));

  const paramsPaginacao: Record<string, string> = {};
  if (filtros.cursoId !== "todos") paramsPaginacao.curso = filtros.cursoId;
  if (filtros.notaMin !== "todas") paramsPaginacao.notaMin = filtros.notaMin;
  if (filtros.notaMax !== "todas") paramsPaginacao.notaMax = filtros.notaMax;
  if (filtros.periodo !== "todos") paramsPaginacao.periodo = filtros.periodo;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Avaliações das aulas</h1>
        <p className="text-muted-foreground text-sm">
          Notas e comentários que os alunos deixam depois de concluir cada aula.
        </p>
      </div>

      {migrationPendente && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler as avaliações (a migration <code>aula_avaliacoes</code> já foi aplicada?).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-6">
            <span className="text-muted-foreground text-sm">Média geral</span>
            <span className="flex items-center gap-2 text-2xl font-semibold">
              <Star className="size-5 fill-amber-400 text-amber-400" />
              {mediaGeral.toFixed(1)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-6">
            <span className="text-muted-foreground text-sm">Total de avaliações</span>
            <span className="text-2xl font-semibold">{totalAvaliacoes}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-6">
            <span className="text-muted-foreground text-sm">Aulas com nota abaixo de 3</span>
            <span className="flex items-center gap-2 text-2xl font-semibold">
              <TrendingDown className="text-destructive size-5" />
              {aulasAbaixoDe3}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-6">
            <span className="text-muted-foreground text-sm">Aula mais bem avaliada</span>
            {melhorAvaliada ? (
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{media(melhorAvaliada.notas).toFixed(1)} ★</span>
                  <span className="text-muted-foreground truncate text-xs">{melhorAvaliada.aulaTitulo}</span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-semibold">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      <AvaliacoesFiltros filtros={filtros} cursos={cursos} />

      {respostaAvaliacoes.error ? (
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            Não foi possível carregar as avaliações. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : linhasPagina.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {todasAulas.length === 0
              ? "Nenhuma avaliação recebida ainda. Quando os alunos avaliarem aulas concluídas, elas aparecem aqui."
              : "Nenhuma aula encontrada com os filtros selecionados."}
          </CardContent>
        </Card>
      ) : (
        <>
          <AvaliacoesTabela linhas={linhasPagina} />
          <Paginacao
            paginaAtual={pagina}
            totalPaginas={totalPaginas}
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
