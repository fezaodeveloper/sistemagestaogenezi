import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCampanhaPagina } from "@/lib/campanha-paginas/campanha-paginas";
import { getCampanhaRespostas } from "@/app/admin/comercial/paginas-campanha/actions";
import { parsePagina } from "@/lib/paginacao";
import { CampanhaRespostasView } from "@/components/admin/campanha-respostas-view";

export default async function CampanhaRespostasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string; page?: string; status_pontuacao?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { data, page, status_pontuacao } = await searchParams;

  const supabase = await createClient();
  const pagina = await getCampanhaPagina(supabase, id);
  if (!pagina) notFound();

  const paginaAtual = parsePagina(page);
  const statusPontuacao = status_pontuacao === "aprovado" || status_pontuacao === "reprovado" ? status_pontuacao : undefined;
  const resultado = await getCampanhaRespostas(
    id,
    paginaAtual,
    data || undefined,
    pagina.habilitar_pontuacao ? statusPontuacao : undefined,
    pagina.pontuacao_minima_bolsa,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{pagina.titulo}</h1>
        <p className="text-muted-foreground text-sm">/campanha/{pagina.slug} — respostas recebidas</p>
      </div>

      <CampanhaRespostasView
        paginaId={id}
        etapas={pagina.etapas}
        mostrarLgpd={pagina.mostrar_lgpd || pagina.etapas.some((etapa) => etapa.tipo === "confirmacao")}
        mostrarDeclaracao={pagina.mostrar_declaracao || pagina.etapas.some((etapa) => etapa.tipo === "confirmacao")}
        habilitarPontuacao={pagina.habilitar_pontuacao}
        pontuacaoMinimaBolsa={pagina.pontuacao_minima_bolsa}
        respostas={resultado.itens}
        totalRegistros={resultado.total}
        paginaAtual={paginaAtual}
        totalPaginas={resultado.totalPaginas}
        dataFiltro={data ?? ""}
        statusPontuacaoFiltro={statusPontuacao ?? ""}
      />
    </div>
  );
}
