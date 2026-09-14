import { requireRole } from "@/lib/auth/dal";
import { listarAlunosVisiveisConecta, listarCandidatosExternos } from "@/app/admin/conecta/candidatos/actions";
import { calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { ConectaCandidatosView } from "@/components/admin/conecta-candidatos-view";

export default async function AdminConectaCandidatosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; limit?: string; query?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const aba = params.tab === "externos" ? "externos" : "alunos";
  const paginaAtual = parsePagina(params.page);
  const limite = parseLimite(params.limit);

  // Só busca os dados da aba ativa — trocar de aba navega pra
  // ?tab=<aba>, então cada requisição já sabe qual das duas listas
  // realmente precisa.
  const resultadoAlunos =
    aba === "alunos"
      ? await listarAlunosVisiveisConecta({ query: params.query, page: paginaAtual, limit: limite })
      : { alunos: [], total: 0 };
  const resultadoExternos =
    aba === "externos"
      ? await listarCandidatosExternos({ query: params.query, page: paginaAtual, limit: limite })
      : { candidatos: [], total: 0 };

  const total = aba === "alunos" ? resultadoAlunos.total : resultadoExternos.total;
  const totalPaginas = calcularTotalPaginas(total, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidatos — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">Perfis de candidatos disponíveis para as empresas.</p>
      </div>

      <ConectaCandidatosView
        aba={aba}
        resultadoAlunos={resultadoAlunos}
        resultadoExternos={resultadoExternos}
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={total}
        limite={limite}
        query={params.query ?? ""}
      />
    </div>
  );
}
