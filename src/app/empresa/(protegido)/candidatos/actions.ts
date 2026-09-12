"use server";

import { requireEmpresa } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CandidatoConecta } from "@/lib/conecta/schema";

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
