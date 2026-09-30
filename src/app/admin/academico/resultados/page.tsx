import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { ResultadosFiltros, type FiltrosResultados } from "@/components/admin/resultados-filtros";
import { ResultadosTabela, type LinhaResultado } from "@/components/admin/resultados-tabela";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";
import { cn } from "@/lib/utils";

const BASE_URL = "/admin/academico/resultados";
const PERIODO_DIAS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

type SearchParams = {
  aba?: string;
  curso?: string;
  status?: string;
  periodo?: string;
  aluno?: string;
  page?: string;
  limit?: string;
};

type TentativaQuizRow = {
  id: string;
  numero: number;
  nota: number;
  aprovado: boolean;
  created_at: string;
  matricula_id: string;
  quizzes: {
    titulo: string;
    aulas: {
      numero: number;
      titulo: string;
      modulo_id: string;
      modulos: { numero: number; titulo: string; curso_id: string; cursos: { id: string; nome: string } | null } | null;
    } | null;
  } | null;
  matriculas: { aluno_id: string } | null;
};

type TentativaProvaRow = {
  id: string;
  numero: number;
  nota: number;
  aprovado: boolean;
  created_at: string;
  matricula_id: string;
  provas: {
    titulo: string;
    modulo_id: string;
    modulos: { numero: number; titulo: string; curso_id: string; cursos: { id: string; nome: string } | null } | null;
  } | null;
  matriculas: { aluno_id: string } | null;
};

type LinhaBase = {
  tentativaId: string;
  alunoId: string;
  cursoId: string;
  cursoNome: string;
  moduloNumero: number;
  itemTitulo: string;
  nota: number;
  aprovado: boolean;
  createdAt: string;
};

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");

  const sp = await searchParams;
  const aba: "quiz" | "prova" = sp.aba === "prova" ? "prova" : "quiz";
  const filtros: FiltrosResultados = {
    aba,
    cursoId: sp.curso ?? "todos",
    status: sp.status ?? "todos",
    periodo: sp.periodo ?? "30",
    aluno: sp.aluno ?? "",
  };
  const pagina = parsePagina(sp.page);
  const limite = parseLimite(sp.limit);

  const supabase = await createClient();

  const [{ data: cursosData }, resultadoAba] = await Promise.all([
    supabase.from("cursos").select("id, nome").order("nome"),
    (async () => {
      const dias = PERIODO_DIAS[filtros.periodo];
      let desde: string | null = null;
      if (dias) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - dias);
        desde = cutoff.toISOString();
      }

      if (aba === "quiz") {
        let query = supabase
          .from("tentativas_quiz")
          .select(
            "id, numero, nota, aprovado, created_at, matricula_id, quizzes(titulo, aulas(numero, titulo, modulo_id, modulos(numero, titulo, curso_id, cursos(id, nome)))), matriculas(aluno_id)",
          );
        if (desde) query = query.gte("created_at", desde);
        return await query;
      }

      let query = supabase
        .from("tentativas_prova")
        .select(
          "id, numero, nota, aprovado, created_at, matricula_id, provas(titulo, modulo_id, modulos(numero, titulo, curso_id, cursos(id, nome))), matriculas(aluno_id)",
        );
      if (desde) query = query.gte("created_at", desde);
      return await query;
    })(),
  ]);

  const cursos = (cursosData ?? []) as { id: string; nome: string }[];
  const migrationPendente = !!resultadoAba.error;

  // GROUP BY não dá pra expressar via PostgREST — agrega em memória, mesmo racional de
  // src/app/admin/academico/avaliacoes/page.tsx (resumo-diario/relatorio-semanal também somam em
  // JS). Volume esperado (tentativas de quiz/prova de uma escola, já filtrado por período) é
  // pequeno o bastante pra isso ser tranquilo.
  let todasLinhas: LinhaBase[] = [];
  if (!resultadoAba.error) {
    if (aba === "quiz") {
      const linhas = (resultadoAba.data ?? []) as unknown as TentativaQuizRow[];
      todasLinhas = linhas
        .filter((l) => l.quizzes?.aulas?.modulos?.cursos && l.matriculas)
        .map((l) => ({
          tentativaId: l.id,
          alunoId: l.matriculas!.aluno_id,
          cursoId: l.quizzes!.aulas!.modulos!.cursos!.id,
          cursoNome: l.quizzes!.aulas!.modulos!.cursos!.nome,
          moduloNumero: l.quizzes!.aulas!.modulos!.numero,
          itemTitulo: `Aula ${l.quizzes!.aulas!.numero} — ${l.quizzes!.titulo}`,
          nota: l.nota,
          aprovado: l.aprovado,
          createdAt: l.created_at,
        }));
    } else {
      const linhas = (resultadoAba.data ?? []) as unknown as TentativaProvaRow[];
      todasLinhas = linhas
        .filter((l) => l.provas?.modulos?.cursos && l.matriculas)
        .map((l) => ({
          tentativaId: l.id,
          alunoId: l.matriculas!.aluno_id,
          cursoId: l.provas!.modulos!.cursos!.id,
          cursoNome: l.provas!.modulos!.cursos!.nome,
          moduloNumero: l.provas!.modulos!.numero,
          itemTitulo: l.provas!.titulo,
          nota: l.nota,
          aprovado: l.aprovado,
          createdAt: l.created_at,
        }));
    }
  }

  // Nomes dos alunos — profiles.id === alunos.id (mesmo usuário), mesmo padrão já usado em
  // vários outros lugares do admin (ex.: painel de moderação de comentários).
  const alunoIds = Array.from(new Set(todasLinhas.map((l) => l.alunoId)));
  const nomesPorAluno = new Map<string, string>();
  if (alunoIds.length > 0) {
    const { data: perfis } = await supabase.from("profiles").select("id, full_name").in("id", alunoIds);
    for (const perfil of (perfis ?? []) as { id: string; full_name: string | null }[]) {
      nomesPorAluno.set(perfil.id, perfil.full_name?.trim() || "Aluno");
    }
  }

  // Filtros em memória (curso, status, aluno) — período já foi filtrado no banco acima.
  let linhasFiltradas = todasLinhas;
  if (filtros.cursoId !== "todos") {
    linhasFiltradas = linhasFiltradas.filter((l) => l.cursoId === filtros.cursoId);
  }
  if (filtros.status !== "todos") {
    const aprovadoAlvo = filtros.status === "aprovado";
    linhasFiltradas = linhasFiltradas.filter((l) => l.aprovado === aprovadoAlvo);
  }
  if (filtros.aluno.trim()) {
    const termo = filtros.aluno.trim().toLowerCase();
    linhasFiltradas = linhasFiltradas.filter((l) => (nomesPorAluno.get(l.alunoId) ?? "").toLowerCase().includes(termo));
  }

  // Mais recente primeiro.
  linhasFiltradas = [...linhasFiltradas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalFiltrado = linhasFiltradas.length;
  const totalPaginas = calcularTotalPaginas(totalFiltrado, limite);
  const offset = calcularOffset(pagina, limite);
  const linhasPagina = linhasFiltradas.slice(offset, offset + limite);

  // Acertos/total de questões objetivas por tentativa — só pra página atual (no máximo `limite`
  // tentativas), contando respostas_quiz/respostas_prova. A "nota" (%) já vem pronta e confiável
  // da tabela (calculada pelo banco em criar_tentativa_quiz/prova); isso aqui é só pra mostrar a
  // fração "X/Y" ao lado, sem recalcular a nota.
  const idsPagina = linhasPagina.map((l) => l.tentativaId);
  const acertosPorTentativa = new Map<string, { acertos: number; total: number }>();
  if (idsPagina.length > 0 && !resultadoAba.error) {
    const tabelaRespostas = aba === "quiz" ? "respostas_quiz" : "respostas_prova";
    const { data: respostas } = await supabase
      .from(tabelaRespostas)
      .select("tentativa_id, correta")
      .in("tentativa_id", idsPagina);

    for (const resposta of (respostas ?? []) as { tentativa_id: string; correta: boolean | null }[]) {
      if (resposta.correta === null) continue; // dissertativa, fora da contagem de objetivas
      const atual = acertosPorTentativa.get(resposta.tentativa_id) ?? { acertos: 0, total: 0 };
      atual.total += 1;
      if (resposta.correta) atual.acertos += 1;
      acertosPorTentativa.set(resposta.tentativa_id, atual);
    }
  }

  const linhasView: LinhaResultado[] = linhasPagina.map((l) => {
    const contagem = acertosPorTentativa.get(l.tentativaId) ?? { acertos: 0, total: 0 };
    return {
      tentativaId: l.tentativaId,
      alunoNome: nomesPorAluno.get(l.alunoId) ?? "Aluno",
      cursoNome: l.cursoNome,
      moduloNumero: l.moduloNumero,
      itemTitulo: l.itemTitulo,
      acertos: contagem.acertos,
      totalObjetivas: contagem.total,
      nota: l.nota,
      aprovado: l.aprovado,
      createdAt: l.createdAt,
    };
  });

  const paramsPaginacao: Record<string, string> = { aba };
  if (filtros.cursoId !== "todos") paramsPaginacao.curso = filtros.cursoId;
  if (filtros.status !== "todos") paramsPaginacao.status = filtros.status;
  if (filtros.periodo !== "30") paramsPaginacao.periodo = filtros.periodo;
  if (filtros.aluno) paramsPaginacao.aluno = filtros.aluno;

  function hrefAba(valor: "quiz" | "prova"): string {
    const params = new URLSearchParams(paramsPaginacao);
    params.set("aba", valor);
    params.delete("page");
    return `${BASE_URL}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Resultados de quiz e prova</h1>
        <p className="text-muted-foreground text-sm">
          Tentativas dos alunos, com nota, aprovação e o detalhamento questão a questão.
        </p>
      </div>

      {migrationPendente && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível carregar as tentativas. Tente recarregar a página.
        </p>
      )}

      <div className="flex gap-2 border-b" role="tablist" aria-label="Quiz ou prova">
        {(["quiz", "prova"] as const).map((valor) => (
          <Link
            key={valor}
            href={hrefAba(valor)}
            role="tab"
            aria-selected={aba === valor}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              aba === valor
                ? "border-primary text-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            {valor === "quiz" ? "Quiz" : "Provas"}
          </Link>
        ))}
      </div>

      <ResultadosFiltros filtros={filtros} cursos={cursos} baseUrl={BASE_URL} />

      {resultadoAba.error ? (
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            Não foi possível carregar os resultados. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : linhasView.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {todasLinhas.length === 0
              ? `Nenhuma tentativa de ${aba === "quiz" ? "quiz" : "prova"} registrada neste período.`
              : "Nenhum resultado encontrado com os filtros selecionados."}
          </CardContent>
        </Card>
      ) : (
        <>
          <ResultadosTabela tipo={aba} linhas={linhasView} />
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
