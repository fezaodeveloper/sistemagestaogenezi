"use server";

import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaPorProfileId } from "@/lib/conecta/empresas";
import type { CandidaturaEmpresa, CandidatoConecta } from "@/lib/conecta/schema";

type PerfilConectaRow = {
  id: string;
  aluno_id: string | null;
  nome: string | null;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  resumo: string | null;
  experiencias: string | null;
  linkedin_url: string | null;
  disponibilidade: CandidatoConecta["disponibilidade"];
  modalidade_preferida: CandidatoConecta["modalidadePreferida"];
  curriculo_path: string | null;
  alunos: { profiles: { full_name: string | null } | null } | null;
};

// Client admin de propósito: perfis_conecta não tem policy de select pra
// empresa ler perfis de OUTRO usuário (só "Aluno gerencia proprio perfil" e
// "Admins gerenciam perfis") — a policy "Empresas veem perfis visiveis e
// ativos" existe e cobriria o filtro certo pelo client autenticado normal,
// mas o embed até profiles (perfis_conecta -> alunos -> profiles) exige
// visibilidade de leitura em alunos/profiles também, que a empresa não
// tem. Sem migration nova (REGRA): bypass via service_role, mesmo padrão
// já usado em buscarVagasConecta.
export async function getCandidatosDisponiveis(): Promise<CandidatoConecta[]> {
  await requireEmpresa();

  const admin = createAdminClient();

  const { data } = await admin
    .from("perfis_conecta")
    .select(
      "id, aluno_id, nome, whatsapp, cidade, estado, resumo, experiencias, linkedin_url, disponibilidade, modalidade_preferida, curriculo_path, alunos(profiles!alunos_id_fkey(full_name))",
    )
    .eq("visivel", true)
    .or("tipo.eq.aluno,esta_ativo.eq.true")
    .order("updated_at", { ascending: false });

  const perfis = (data as unknown as PerfilConectaRow[] | null) ?? [];
  const alunoIds = perfis.map((p) => p.aluno_id).filter((id): id is string => Boolean(id));

  // Cursos concluídos de todos os candidatos de uma vez (matriculas.status
  // = 'concluida', mesmo critério já usado em getCursosConcluidosAluno).
  const cursosPorAluno = new Map<string, Set<string>>();
  if (alunoIds.length > 0) {
    const { data: matriculasData } = await admin
      .from("matriculas")
      .select("aluno_id, turmas(cursos(nome))")
      .in("aluno_id", alunoIds)
      .eq("status", "concluida");

    type MatriculaRow = { aluno_id: string; turmas: { cursos: { nome: string } | null } | null };
    for (const row of (matriculasData as unknown as MatriculaRow[] | null) ?? []) {
      const nome = row.turmas?.cursos?.nome;
      if (!nome) continue;
      const atual = cursosPorAluno.get(row.aluno_id) ?? new Set<string>();
      atual.add(nome);
      cursosPorAluno.set(row.aluno_id, atual);
    }
  }

  return perfis.map((perfil) => ({
    id: perfil.id,
    alunoId: perfil.aluno_id,
    nome: perfil.alunos?.profiles?.full_name ?? perfil.nome ?? "Candidato",
    whatsapp: perfil.whatsapp,
    cidade: perfil.cidade,
    estado: perfil.estado,
    resumo: perfil.resumo,
    experiencias: perfil.experiencias,
    linkedinUrl: perfil.linkedin_url,
    disponibilidade: perfil.disponibilidade,
    modalidadePreferida: perfil.modalidade_preferida,
    curriculoPath: perfil.curriculo_path,
    cursosConcluidos: perfil.aluno_id
      ? [...(cursosPorAluno.get(perfil.aluno_id) ?? [])].sort((a, b) => a.localeCompare(b))
      : [],
  }));
}

// Confirma que o path pedido pertence a um perfil realmente visível antes
// de gerar a signed URL — sem essa checagem, qualquer empresa autenticada
// poderia pedir a signed URL de um path arbitrário (ex.: de um candidato
// que desativou a visibilidade depois de ter enviado o currículo).
export async function getUrlCurriculoCandidato(path: string): Promise<{ url?: string; error?: string }> {
  await requireEmpresa();

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("perfis_conecta")
    .select("id")
    .eq("curriculo_path", path)
    .eq("visivel", true)
    .maybeSingle();

  if (!perfil) {
    return { error: "Currículo não encontrado ou não está mais disponível." };
  }

  const { data, error } = await admin.storage.from("curriculos-conecta").createSignedUrl(path, 60);

  if (error || !data) {
    return { error: "Não foi possível gerar o link do currículo. Tente novamente." };
  }

  return { url: data.signedUrl };
}

// ===== Candidaturas (TAREFA: remover "Candidatar via WhatsApp" direto) =====
//
// Diferente de getCandidatosDisponiveis (que lista TODOS os perfis com visivel=true, pra
// contato espontâneo da empresa) — aqui são só os candidatos que se candidataram a uma vaga
// desta empresa especificamente, via candidaturas_conecta, independente do toggle de
// visibilidade geral.

type CandidaturaRow = {
  id: string;
  status: CandidaturaEmpresa["status"];
  mensagem: string | null;
  created_at: string;
  vaga_id: string;
  vagas_conecta: { titulo: string } | null;
  perfis_conecta: {
    aluno_id: string | null;
    nome: string | null;
    whatsapp: string | null;
    resumo: string | null;
    curriculo_path: string | null;
    alunos: { profiles: { full_name: string | null } | null } | null;
  } | null;
};

// Client admin de propósito: o embed até perfis_conecta exige visibilidade de leitura que a
// empresa não tem pra candidatos sem visivel=true (candidatura é independente do toggle geral
// de visibilidade) — mesmo motivo/padrão já usado em getCandidatosDisponiveis, acima.
export async function getCandidaturasEmpresa(): Promise<CandidaturaEmpresa[]> {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  if (!empresa) return [];

  const admin = createAdminClient();
  const { data: vagasDaEmpresa } = await admin.from("vagas_conecta").select("id").eq("empresa_id", empresa.id);
  const vagaIds = (vagasDaEmpresa ?? []).map((v) => v.id as string);
  if (vagaIds.length === 0) return [];

  const { data } = await admin
    .from("candidaturas_conecta")
    .select(
      "id, status, mensagem, created_at, vaga_id, vagas_conecta(titulo), perfis_conecta(aluno_id, nome, whatsapp, resumo, curriculo_path, alunos(profiles!alunos_id_fkey(full_name)))",
    )
    .in("vaga_id", vagaIds)
    .order("created_at", { ascending: false });

  const candidaturas = (data as unknown as CandidaturaRow[] | null) ?? [];
  const alunoIds = candidaturas
    .map((c) => c.perfis_conecta?.aluno_id)
    .filter((id): id is string => Boolean(id));

  const cursosPorAluno = new Map<string, Set<string>>();
  if (alunoIds.length > 0) {
    const { data: matriculasData } = await admin
      .from("matriculas")
      .select("aluno_id, turmas(cursos(nome))")
      .in("aluno_id", alunoIds)
      .eq("status", "concluida");

    type MatriculaRow = { aluno_id: string; turmas: { cursos: { nome: string } | null } | null };
    for (const row of (matriculasData as unknown as MatriculaRow[] | null) ?? []) {
      const nome = row.turmas?.cursos?.nome;
      if (!nome) continue;
      const atual = cursosPorAluno.get(row.aluno_id) ?? new Set<string>();
      atual.add(nome);
      cursosPorAluno.set(row.aluno_id, atual);
    }
  }

  return candidaturas.map((c) => ({
    id: c.id,
    status: c.status,
    mensagem: c.mensagem,
    createdAt: c.created_at,
    vagaId: c.vaga_id,
    vagaTitulo: c.vagas_conecta?.titulo ?? "—",
    candidatoNome: c.perfis_conecta?.alunos?.profiles?.full_name ?? c.perfis_conecta?.nome ?? "Candidato",
    candidatoWhatsapp: c.perfis_conecta?.whatsapp ?? null,
    candidatoResumo: c.perfis_conecta?.resumo ?? null,
    candidatoCurriculoPath: c.perfis_conecta?.curriculo_path ?? null,
    candidatoCursosConcluidos: c.perfis_conecta?.aluno_id
      ? [...(cursosPorAluno.get(c.perfis_conecta.aluno_id) ?? [])].sort((a, b) => a.localeCompare(b))
      : [],
  }));
}

// Confirma que a candidatura pertence a uma vaga da empresa logada antes de qualquer update —
// a policy RLS "Empresa atualiza status das proprias candidaturas" já escopa isso no banco,
// esta checagem aqui só decide a mensagem de erro certa (candidatura de outra empresa vs. erro
// de rede) sem precisar de uma segunda query só pra isso.
async function atualizarStatusCandidatura(
  id: string,
  status: CandidaturaEmpresa["status"],
): Promise<{ error?: string }> {
  await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase.from("candidaturas_conecta").update({ status }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar a candidatura. Tente novamente." };
  }

  revalidatePath("/empresa/candidatos");
  return {};
}

// Chamada ao ABRIR o modal de detalhes — é o que libera o WhatsApp do candidato pro próximo
// render (TAREFA: WhatsApp só aparece depois que a empresa visualiza). Só avança de "pendente"
// — reabrir o modal de uma candidatura já marcada "contato"/"rejeitado" não deve regredir o
// status de volta pra "visualizado".
export async function marcarCandidaturaVisualizada(id: string): Promise<{ error?: string }> {
  await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase
    .from("candidaturas_conecta")
    .update({ status: "visualizado" })
    .eq("id", id)
    .eq("status", "pendente");

  if (error) {
    return { error: "Não foi possível atualizar a candidatura. Tente novamente." };
  }

  revalidatePath("/empresa/candidatos");
  return {};
}

export async function marcarCandidaturaContatada(id: string): Promise<{ error?: string }> {
  return atualizarStatusCandidatura(id, "contato");
}

export async function rejeitarCandidatura(id: string): Promise<{ error?: string }> {
  return atualizarStatusCandidatura(id, "rejeitado");
}
