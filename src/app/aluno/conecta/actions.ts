"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  perfilConectaFormSchema,
  type PerfilConecta,
  type VagaConecta,
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
//
// Reescrito em duas queries simples + merge em JS (mesmo padrão já usado
// noutras agregações deste projeto, ex.: vagasPorCurso em aluno/page.tsx)
// em vez de um único select com embed `!inner` + filtro na tabela
// embutida + count — essa combinação (inner join filtrado + count: exact)
// é um ponto conhecido de comportamento inconsistente do
// supabase-js/PostgREST em alguns cenários, e era a suspeita mais provável
// de "vagas não aparecem" (PROBLEMA 4): mais fácil de garantir correto (e
// de depurar) com duas consultas diretas do que com uma única consulta
// combinada.
export async function buscarVagasConecta(
  filtro: VagasConectaFiltro = {},
): Promise<VagasConectaResultado> {
  await requireRole("aluno");

  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;

  const admin = createAdminClient();

  // 1) Empresas ativas — tabela pequena, busca inteira de uma vez.
  const { data: empresasAtivasData } = await admin
    .from("empresas_conecta")
    .select("id, nome_empresa, whatsapp, logo_url")
    .eq("status", "ativa");
  const empresasPorId = new Map(
    (empresasAtivasData ?? []).map((empresa) => [
      empresa.id as string,
      {
        nome: empresa.nome_empresa as string,
        whatsapp: empresa.whatsapp as string | null,
        logoUrl: empresa.logo_url as string | null,
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

  // 2) Vagas ativas — filtros locais (tipo, modalidade, cidade, título) já
  // vão direto na query; "empresa ativa" e "nome da empresa" são aplicados
  // depois, em JS, com o Map montado acima.
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
    };
  });

  return { vagas, total };
}

// Signed URL de curta duração (60s) — mesmo padrão de materiais/certificados
// (bucket privado, sem URL pública fixa). Client admin necessário: o bucket
// é privado e createSignedUrl não é afetado pela RLS do client autenticado
// mesmo sendo o próprio dono, porque a policy de select do bucket restringe
// a empresa/admin (ver migration de storage) — o aluno lê o PRÓPRIO
// currículo por aqui, contornando essa restrição com segurança porque a
// action já confirma que o path pertence à sessão autenticada.
export async function getUrlCurriculoConecta(): Promise<{ url?: string; error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_conecta")
    .select("curriculo_path")
    .eq("aluno_id", user.id)
    .maybeSingle();

  if (!perfil?.curriculo_path) {
    return { error: "Nenhum currículo enviado ainda." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("curriculos-conecta")
    .createSignedUrl(perfil.curriculo_path, 60);

  if (error || !data) {
    return { error: "Não foi possível gerar o link do currículo. Tente novamente." };
  }

  return { url: data.signedUrl };
}
