import { requireRole } from "@/lib/auth/dal";
import { getVagasAdminConecta } from "@/app/admin/conecta/vagas/actions";
import { calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import {
  VAGA_MODALIDADES,
  VAGA_STATUSES,
  VAGA_TIPOS,
  type VagaModalidade,
  type VagaStatus,
  type VagaTipo,
} from "@/lib/conecta/schema";
import { ConectaVagasAdminView } from "@/components/admin/conecta-vagas-admin-view";

function paramValido<T extends string>(valores: readonly T[], valor: string | undefined): T | undefined {
  return valores.includes(valor as T) ? (valor as T) : undefined;
}

export default async function AdminConectaVagasPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    query?: string;
    status?: string;
    tipo?: string;
    modalidade?: string;
  }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const paginaAtual = parsePagina(params.page);
  const limite = parseLimite(params.limit);
  const status = paramValido<VagaStatus>(VAGA_STATUSES, params.status);
  const tipo = paramValido<VagaTipo>(VAGA_TIPOS, params.tipo);
  const modalidade = paramValido<VagaModalidade>(VAGA_MODALIDADES, params.modalidade);

  const { vagas, total } = await getVagasAdminConecta({
    query: params.query,
    status,
    tipo,
    modalidade,
    page: paginaAtual,
    limit: limite,
  });
  const totalPaginas = calcularTotalPaginas(total, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Vagas — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">Todas as vagas publicadas pelas empresas parceiras.</p>
      </div>

      <ConectaVagasAdminView
        vagas={vagas}
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={total}
        limite={limite}
        filtrosAtuais={{
          query: params.query ?? "",
          status: status ?? "",
          tipo: tipo ?? "",
          modalidade: modalidade ?? "",
        }}
      />
    </div>
  );
}
