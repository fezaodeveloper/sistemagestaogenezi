"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  perfilConectaFormSchema,
  type PerfilConecta,
  type VagasConectaFiltro,
  type VagasConectaResultado,
  type VagaConectaComEmpresa,
} from "@/lib/conecta/schema";

const LIMITE_PADRAO = 12;

// matriculas.status = 'concluida' já significa curso concluído (mesmo
// critério usado em aluno/page.tsx pra agrupar cursos) — mais simples que
// juntar aulas_concluidas pra chegar na mesma informação.
export async function getCursosConcluidosAluno(alunoId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matriculas")
    .select("turmas(cursos(nome))")
    .eq("aluno_id", alunoId)
    .eq("status", "concluida");

  type Row = { turmas: { cursos: { nome: string } | null } | null };
  const nomes = ((data as unknown as Row[]) ?? [])
    .map((row) => row.turmas?.cursos?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b));
}

export async function getMeuPerfilConecta(): Promise<PerfilConecta | null> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis_conecta")
    .select("*")
    .eq("aluno_id", user.id)
    .maybeSingle();

  return (data as PerfilConecta | null) ?? null;
}

export async function salvarPerfilConecta(formData: FormData): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const parsed = perfilConectaFormSchema.safeParse({
    whatsapp: formData.get("whatsapp") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    resumo: formData.get("resumo") || undefined,
    experiencias: formData.get("experiencias") || undefined,
    linkedin_url: formData.get("linkedin_url") || undefined,
    disponibilidade: formData.get("disponibilidade"),
    modalidade_preferida: formData.get("modalidade_preferida"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const data = parsed.data;
  const supabase = await createClient();
  // upsert com onConflict em aluno_id (unique na tabela) — cobre tanto o
  // primeiro salvamento (linha ainda não existe) quanto edições
  // seguintes, sem precisar checar antes se já existe uma linha.
  const { error } = await supabase.from("perfis_conecta").upsert(
    {
      aluno_id: user.id,
      tipo: "aluno",
      whatsapp: data.whatsapp ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      resumo: data.resumo ?? null,
      experiencias: data.experiencias ?? null,
      linkedin_url: data.linkedin_url ?? null,
      disponibilidade: data.disponibilidade,
      modalidade_preferida: data.modalidade_preferida,
    },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Não foi possível salvar o perfil. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// WhatsApp obrigatório só ao ATIVAR a visibilidade (REGRA da tarefa) — checa
// o valor já salvo em vez de exigir que o form de dados seja reenviado
// junto do toggle.
export async function toggleVisibilidadePerfil(visivel: boolean): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();

  if (visivel) {
    const { data: perfil } = await supabase
      .from("perfis_conecta")
      .select("whatsapp")
      .eq("aluno_id", user.id)
      .maybeSingle();

    if (!perfil?.whatsapp) {
      return { error: "Informe seu WhatsApp antes de tornar o perfil visível." };
    }
  }

  const { error } = await supabase.from("perfis_conecta").upsert(
    { aluno_id: user.id, tipo: "aluno", visivel },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Não foi possível atualizar a visibilidade. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// Upload em si acontece do lado do client, direto pro Supabase Storage
// (mesmo padrão de foto-aluno-upload.tsx) — essa action só grava o path já
// pronto na tabela. curriculo_url guarda o NOME ORIGINAL do arquivo (só
// pra exibição — "mostrar nome do arquivo atual"), não uma URL de verdade:
// o bucket é privado, então não existe uma URL pública fixa pra guardar
// ali; a coluna é reaproveitada porque já existe desde a Etapa 1 (sem
// migration nova).
export async function uploadCurriculoConecta(
  path: string,
  nomeArquivo: string,
): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { error } = await supabase.from("perfis_conecta").upsert(
    { aluno_id: user.id, tipo: "aluno", curriculo_path: path, curriculo_url: nomeArquivo },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Currículo enviado mas não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

export async function removerCurriculoConecta(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_conecta")
    .select("curriculo_path")
    .eq("aluno_id", user.id)
    .maybeSingle();

  if (perfil?.curriculo_path) {
    await supabase.storage.from("curriculos-conecta").remove([perfil.curriculo_path]);
  }

  const { error } = await supabase
    .from("perfis_conecta")
    .update({ curriculo_path: null, curriculo_url: null })
    .eq("aluno_id", user.id);

  if (error) {
    return { error: "Não foi possível remover o currículo. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// Client admin de propósito: listar "vagas ativas de empresas ativas" é
// informação pública dentro da plataforma (mural de vagas visível a
// qualquer aluno), mas empresas_conecta não tem policy de select liberando
// leitura pra quem não é a própria empresa ou admin — só teria os dados da
// vaga em si, sem nome/whatsapp/logo da empresa, se fosse pelo client
// autenticado normal. Sem migration nova (REGRA): bypass via service_role,
// mesmo padrão já usado noutras leituras agregadas deste projeto.
export async function buscarVagasConecta(
  filtro: VagasConectaFiltro = {},
): Promise<VagasConectaResultado> {
  await requireRole("aluno");

  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  // "Buscar por cargo ou empresa": .or() do PostgREST não combina bem uma
  // condição local (titulo) com uma condição de tabela embutida
  // (empresas_conecta.nome_empresa) no mesmo filtro — resolve em duas
  // etapas: acha os ids de empresa cujo nome bate, depois usa esses ids
  // (coluna local, empresa_id) junto do título no mesmo .or().
  const termo = filtro.query?.trim();
  let empresaIdsComNomeCompativel: string[] = [];
  if (termo) {
    const { data: empresasCompativeis } = await admin
      .from("empresas_conecta")
      .select("id")
      .ilike("nome_empresa", `%${termo}%`);
    empresaIdsComNomeCompativel = (empresasCompativeis ?? []).map((e) => e.id as string);
  }

  let query = admin
    .from("vagas_conecta")
    .select("*, empresas_conecta!inner(nome_empresa, whatsapp, logo_url, status)", { count: "exact" })
    .eq("status", "ativa")
    .eq("empresas_conecta.status", "ativa");

  if (termo) {
    const condicoes = [`titulo.ilike.%${termo}%`];
    if (empresaIdsComNomeCompativel.length > 0) {
      condicoes.push(`empresa_id.in.(${empresaIdsComNomeCompativel.join(",")})`);
    }
    query = query.or(condicoes.join(","));
  }
  if (filtro.tipo) {
    query = query.eq("tipo", filtro.tipo);
  }
  if (filtro.modalidade) {
    query = query.eq("modalidade", filtro.modalidade);
  }
  if (filtro.cidade?.trim()) {
    query = query.ilike("cidade", `%${filtro.cidade.trim()}%`);
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  type VagaRow = VagaConectaComEmpresa & {
    empresas_conecta: { nome_empresa: string; whatsapp: string | null; logo_url: string | null } | null;
  };

  const vagas: VagaConectaComEmpresa[] = ((data as unknown as VagaRow[] | null) ?? []).map((row) => ({
    ...row,
    empresaNome: row.empresas_conecta?.nome_empresa ?? "Empresa",
    empresaWhatsapp: row.empresas_conecta?.whatsapp ?? null,
    empresaLogoUrl: row.empresas_conecta?.logo_url ?? null,
  }));

  return { vagas, total: count ?? 0 };
}
