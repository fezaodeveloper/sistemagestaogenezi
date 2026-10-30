"use server";

import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaPorProfileId } from "@/lib/conecta/empresas";
import { notificarCandidatoContratado, notificarCandidatoRejeitado } from "@/lib/conecta/telegram";
import { enviarWhatsappRejeicaoConecta } from "@/lib/conecta/whatsapp";
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
  profiles: { full_name: string | null } | null;
};

// Client admin de propósito: perfis_conecta não tem policy de select pra
// empresa ler perfis de OUTRO usuário (só "Aluno gerencia proprio perfil" e
// "Admins gerenciam perfis") — a policy "Empresas veem perfis visiveis e
// ativos" existe e cobriria o filtro certo pelo client autenticado normal,
// mas o embed até profiles exige visibilidade de leitura em profiles
// também, que a empresa não tem. Sem migration nova (REGRA): bypass via
// service_role, mesmo padrão já usado em buscarVagasConecta.
//
// nome vem de profiles.full_name direto (NÃO via alunos->profiles): perfis_conecta.aluno_id
// referencia profiles(id), não alunos(id) — ver comentário em listarAlunosVisiveisConecta
// (admin/conecta/candidatos/actions.ts) sobre o PGRST200 real causado por esse embed errado.
export async function getCandidatosDisponiveis(): Promise<CandidatoConecta[]> {
  await requireEmpresa();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("perfis_conecta")
    .select(
      "id, aluno_id, nome, whatsapp, cidade, estado, resumo, experiencias, linkedin_url, disponibilidade, modalidade_preferida, curriculo_path, profiles!perfis_conecta_aluno_id_fkey(full_name)",
    )
    .eq("visivel", true)
    .or("tipo.eq.aluno,esta_ativo.eq.true")
    .order("updated_at", { ascending: false });

  // Erro de query antes era descartado em silêncio (data vinha undefined, perfis ficava [] sem
  // nenhum rastro) — sem isso, um erro de verdade (embed do PostgREST, grant faltando) parecia
  // exatamente igual a "não tem candidato disponível". Logado aqui pra aparecer nos logs da
  // função no Vercel na próxima vez que isso acontecer.
  if (error) {
    console.error("[getCandidatosDisponiveis] erro ao buscar perfis_conecta:", error);
  }

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
    nome: perfil.profiles?.full_name ?? perfil.nome ?? "Candidato",
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
    profiles: { full_name: string | null } | null;
  } | null;
};

// Client admin de propósito: o embed até perfis_conecta exige visibilidade de leitura que a
// empresa não tem pra candidatos sem visivel=true (candidatura é independente do toggle geral
// de visibilidade) — mesmo motivo/padrão já usado em getCandidatosDisponiveis, acima.
//
// nome vem de profiles.full_name direto (NÃO via alunos->profiles) — ver comentário em
// listarAlunosVisiveisConecta (admin/conecta/candidatos/actions.ts) sobre o PGRST200 real
// ("Could not find a relationship between 'perfis_conecta' and 'alunos'") causado pelo embed
// antigo: perfis_conecta.aluno_id referencia profiles(id), não alunos(id).
export async function getCandidaturasEmpresa(): Promise<CandidaturaEmpresa[]> {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  if (!empresa) return [];

  const admin = createAdminClient();
  const { data: vagasDaEmpresa, error: erroVagas } = await admin
    .from("vagas_conecta")
    .select("id")
    .eq("empresa_id", empresa.id);
  if (erroVagas) {
    console.error("[getCandidaturasEmpresa] erro ao buscar vagas_conecta:", erroVagas);
  }
  const vagaIds = (vagasDaEmpresa ?? []).map((v) => v.id as string);
  if (vagaIds.length === 0) return [];

  const { data, error } = await admin
    .from("candidaturas_conecta")
    .select(
      "id, status, mensagem, created_at, vaga_id, vagas_conecta(titulo), perfis_conecta(aluno_id, nome, whatsapp, resumo, curriculo_path, profiles!perfis_conecta_aluno_id_fkey(full_name))",
    )
    .in("vaga_id", vagaIds)
    .order("created_at", { ascending: false });

  // Mesmo motivo do log em getCandidatosDisponiveis (acima) — sem isso, um erro real de query
  // (ex.: embed do PostgREST) é indistinguível de "nenhuma candidatura ainda" na tela da empresa.
  if (error) {
    console.error("[getCandidaturasEmpresa] erro ao buscar candidaturas_conecta:", error);
  }

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
    candidatoNome: c.perfis_conecta?.profiles?.full_name ?? c.perfis_conecta?.nome ?? "Candidato",
    candidatoWhatsapp: c.perfis_conecta?.whatsapp ?? null,
    candidatoResumo: c.perfis_conecta?.resumo ?? null,
    candidatoCurriculoPath: c.perfis_conecta?.curriculo_path ?? null,
    candidatoCursosConcluidos: c.perfis_conecta?.aluno_id
      ? [...(cursosPorAluno.get(c.perfis_conecta.aluno_id) ?? [])].sort((a, b) => a.localeCompare(b))
      : [],
  }));
}

// Dados de contato/identificação pra notificar contratação/rejeição (TAREFA: Telegram +
// WhatsApp). Client admin de propósito: mesmo motivo do embed em getCandidaturasEmpresa (acima)
// — a empresa não tem RLS de leitura em perfis_conecta/profiles de candidatos sem visivel=true.
async function buscarDadosNotificacaoCandidatura(id: string): Promise<{
  vagaTitulo: string;
  nomeEmpresa: string;
  nomeAluno: string;
  whatsapp: string | null;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("candidaturas_conecta")
    .select(
      "vagas_conecta(titulo, empresas_conecta(nome_empresa)), perfis_conecta(nome, whatsapp, profiles!perfis_conecta_aluno_id_fkey(full_name))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  type Row = {
    vagas_conecta: { titulo: string; empresas_conecta: { nome_empresa: string } | null } | null;
    perfis_conecta: {
      nome: string | null;
      whatsapp: string | null;
      profiles: { full_name: string | null } | null;
    } | null;
  };
  const row = data as unknown as Row;

  return {
    vagaTitulo: row.vagas_conecta?.titulo ?? "—",
    nomeEmpresa: row.vagas_conecta?.empresas_conecta?.nome_empresa ?? "—",
    nomeAluno: row.perfis_conecta?.profiles?.full_name ?? row.perfis_conecta?.nome ?? "Candidato",
    whatsapp: row.perfis_conecta?.whatsapp ?? null,
  };
}

// Best-effort — nunca lança (mesma política de notificação do resto do Conecta): a mudança de
// status já foi salva com sucesso antes desta chamada, uma falha aqui não pode desfazer isso.
async function notificarMudancaStatusCandidatura(id: string, status: "contratado" | "rejeitado"): Promise<void> {
  try {
    const dados = await buscarDadosNotificacaoCandidatura(id);
    if (!dados) return;

    if (status === "contratado") {
      await notificarCandidatoContratado(dados);
      return;
    }

    await notificarCandidatoRejeitado(dados);
    if (dados.whatsapp) {
      await enviarWhatsappRejeicaoConecta(dados.whatsapp, dados.nomeAluno, dados.vagaTitulo, dados.nomeEmpresa);
    }
  } catch {
    // Best-effort — ver comentário acima.
  }
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

  if (status === "contratado" || status === "rejeitado") {
    await notificarMudancaStatusCandidatura(id, status);
  }

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

export async function marcarCandidaturaContratada(id: string): Promise<{ error?: string }> {
  return atualizarStatusCandidatura(id, "contratado");
}

export async function rejeitarCandidatura(id: string): Promise<{ error?: string }> {
  return atualizarStatusCandidatura(id, "rejeitado");
}

// TAREFA: "Rejeitar todos os pendentes desta vaga" — um único UPDATE em massa (não chama
// atualizarStatusCandidatura em loop, que faria 1 UPDATE por linha) e notifica cada candidato
// individualmente depois, já que cada um tem WhatsApp/nome diferentes.
export async function rejeitarTodosPendentesDaVaga(vagaId: string): Promise<{ error?: string }> {
  await requireEmpresa();

  const supabase = await createClient();
  const { data: pendentes, error: erroSelect } = await supabase
    .from("candidaturas_conecta")
    .select("id")
    .eq("vaga_id", vagaId)
    .eq("status", "pendente");

  if (erroSelect) {
    return { error: "Não foi possível buscar as candidaturas pendentes. Tente novamente." };
  }

  const ids = (pendentes ?? []).map((c) => c.id as string);
  if (ids.length === 0) return {};

  const { error } = await supabase.from("candidaturas_conecta").update({ status: "rejeitado" }).in("id", ids);

  if (error) {
    return { error: "Não foi possível rejeitar as candidaturas. Tente novamente." };
  }

  revalidatePath("/empresa/candidatos");

  for (const id of ids) {
    await notificarMudancaStatusCandidatura(id, "rejeitado");
  }

  return {};
}
