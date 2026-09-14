import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CidadeConecta,
  EmpresaConecta,
  VagaConecta,
  VagaConectaComEmpresa,
  VagasConectaFiltro,
  VagasConectaResultado,
} from "@/lib/conecta/schema";

const LIMITE_PADRAO = 12;

// Consultas de acesso PÚBLICO (sem sessão) — usadas pelas páginas
// /conecta/vagas e /conecta/empresa/[id] (REGRA da tarefa: páginas públicas
// de propósito, pra SEO e compartilhamento). empresas_conecta e
// vagas_conecta não têm grant de select pra "anon" (só authenticated e
// service_role, ver migrations da Etapa 1) — client admin (service_role) é
// o único jeito de ler essas tabelas sem sessão nenhuma, mesmo padrão já
// usado em buscarVagasConecta (portal do aluno).

// Corpo idêntico ao antigo buscarVagasConecta (src/app/aluno/conecta/actions.ts),
// só sem o requireRole("aluno") — extraído pra cá pra ser reaproveitado
// tanto pelo portal autenticado do aluno quanto pela página pública, sem
// duplicar a lógica de merge em JS (ver comentário original sobre o ponto
// frágil do embed !inner + count).
export async function getVagasPublicasConecta(
  filtro: VagasConectaFiltro = {},
): Promise<VagasConectaResultado> {
  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;

  const admin = createAdminClient();

  const { data: empresasAtivasData } = await admin
    .from("empresas_conecta")
    .select("id, nome_empresa, whatsapp, logo_url, setor, cidade, estado, endereco, link_maps, site")
    .eq("status", "ativa");
  const empresasPorId = new Map(
    (empresasAtivasData ?? []).map((empresa) => [
      empresa.id as string,
      {
        nome: empresa.nome_empresa as string,
        whatsapp: empresa.whatsapp as string | null,
        logoUrl: empresa.logo_url as string | null,
        setor: empresa.setor as string | null,
        cidade: empresa.cidade as string | null,
        estado: empresa.estado as string | null,
        endereco: empresa.endereco as string | null,
        linkMaps: empresa.link_maps as string | null,
        site: empresa.site as string | null,
      },
    ]),
  );

  const termo = filtro.query?.trim().toLowerCase();
  const empresaIdsComNomeCompativel = termo
    ? new Set(
        [...empresasPorId.entries()]
          .filter(([, empresa]) => empresa.nome.toLowerCase().includes(termo))
          .map(([id]) => id),
      )
    : null;

  let query = admin.from("vagas_conecta").select("*").eq("status", "ativa");

  if (filtro.tipo) query = query.eq("tipo", filtro.tipo);
  if (filtro.modalidade) query = query.eq("modalidade", filtro.modalidade);
  if (filtro.cidade?.trim()) query = query.ilike("cidade", `%${filtro.cidade.trim()}%`);

  const { data: vagasData } = await query.order("created_at", { ascending: false });

  const vagasFiltradas = ((vagasData as VagaConecta[] | null) ?? []).filter((vaga) => {
    if (!empresasPorId.has(vaga.empresa_id)) return false;
    if (!termo) return true;
    const tituloBate = vaga.titulo.toLowerCase().includes(termo);
    const empresaBate = empresaIdsComNomeCompativel?.has(vaga.empresa_id) ?? false;
    return tituloBate || empresaBate;
  });

  const total = vagasFiltradas.length;
  const offset = (page - 1) * limit;
  const pagina = vagasFiltradas.slice(offset, offset + limit);

  const vagas: VagaConectaComEmpresa[] = pagina.map((vaga) => {
    const empresa = empresasPorId.get(vaga.empresa_id);
    return {
      ...vaga,
      empresaNome: empresa?.nome ?? "Empresa",
      empresaWhatsapp: empresa?.whatsapp ?? null,
      empresaLogoUrl: empresa?.logoUrl ?? null,
      empresaSetor: empresa?.setor ?? null,
      empresaCidade: empresa?.cidade ?? null,
      empresaEstado: empresa?.estado ?? null,
      empresaEndereco: empresa?.endereco ?? null,
      empresaLinkMaps: empresa?.linkMaps ?? null,
      empresaSite: empresa?.site ?? null,
    };
  });

  return { vagas, total };
}

export async function getEmpresaPublicaConecta(empresaId: string): Promise<EmpresaConecta | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas_conecta")
    .select("*")
    .eq("id", empresaId)
    .eq("status", "ativa")
    .maybeSingle();

  return (data as EmpresaConecta | null) ?? null;
}

// Lista de cidades onde empresas podem cadastrar vaga (restrição a SE/AL,
// gerenciada pelo admin em /admin/conecta/cidades). Client admin aqui
// porque esta função também é chamada pelas páginas públicas
// (/conecta/vagas) — mesmo quando "anon" já tem grant de select nessa
// tabela especificamente, manter o mesmo client em todos os call sites
// evita comportamento diferente por contexto de chamada (REGRA da tarefa).
export async function getCidadesAprovadas(): Promise<CidadeConecta[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("conecta_cidades")
    .select("*")
    .eq("ativa", true)
    .order("estado", { ascending: true })
    .order("ordem", { ascending: true });

  return (data as CidadeConecta[] | null) ?? [];
}

export async function getVagasAtivasDaEmpresaPublica(empresaId: string): Promise<VagaConecta[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vagas_conecta")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "ativa")
    .order("created_at", { ascending: false });

  return (data as VagaConecta[] | null) ?? [];
}
