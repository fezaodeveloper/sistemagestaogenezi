"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cursoGratuitoFormSchema } from "@/lib/cursos/schema";
import { uploadImagem, validarImagem } from "@/lib/storage/validar-imagem";

// Mesmo bucket já usado pela capa dos cursos regulares (público, só admin escreve — ver
// 20260825100000_add_capa_cursos.sql) — a foto do curso gratuito é só mais um tipo de imagem na
// mesma tabela "cursos", sem motivo pra um bucket separado.
const CURSOS_BUCKET = "cursos";

type CursoGratuitoFormValuesEcho = {
  nome: string;
  descricao: string;
  url_plataforma_externa: string;
  carga_horaria: string;
  status: string;
};

export type CursoGratuitoFormState =
  | {
      errors?: Partial<Record<"nome" | "descricao" | "url_plataforma_externa" | "carga_horaria" | "status" | "foto", string[]>>;
      error?: string;
      values?: CursoGratuitoFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): CursoGratuitoFormValuesEcho {
  return {
    nome: String(formData.get("nome") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
    url_plataforma_externa: String(formData.get("url_plataforma_externa") ?? ""),
    carga_horaria: String(formData.get("carga_horaria") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
}

function parseCursoGratuitoForm(formData: FormData) {
  return cursoGratuitoFormSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    url_plataforma_externa: formData.get("url_plataforma_externa"),
    carga_horaria: formData.get("carga_horaria") || undefined,
    status: formData.get("status"),
  });
}

export async function criarCursoGratuito(
  _prevState: CursoGratuitoFormState,
  formData: FormData,
): Promise<CursoGratuitoFormState> {
  await requireRole("admin");

  const parsed = parseCursoGratuitoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const { erro: erroFoto, arquivo: arquivoFoto } = validarImagem(formData.get("foto"));
  if (erroFoto) {
    return { errors: { foto: [erroFoto] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let fotoPath: string | null = null;
  if (arquivoFoto) {
    const { path, error: uploadError } = await uploadImagem(supabase, CURSOS_BUCKET, arquivoFoto);
    if (uploadError || !path) {
      return { error: "Não foi possível enviar a foto. Tente novamente.", values: echoValues(formData) };
    }
    fotoPath = path;
  }
  const fotoUrl = fotoPath ? supabase.storage.from(CURSOS_BUCKET).getPublicUrl(fotoPath).data.publicUrl : null;

  const { error } = await supabase.from("cursos").insert({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao ?? null,
    url_plataforma_externa: parsed.data.url_plataforma_externa,
    carga_horaria: parsed.data.carga_horaria ?? null,
    foto_url: fotoUrl,
    foto_path: fotoPath,
    status: parsed.data.status,
    // Curso gratuito é sempre hospedado numa plataforma externa — "tipo" não tem equivalente
    // real pra esse caso, mas a coluna é not null sem default; "ead" é o mais próximo.
    tipo: "ead",
    gratuito: true,
  });

  if (error) {
    if (fotoPath) await supabase.storage.from(CURSOS_BUCKET).remove([fotoPath]);
    return {
      error: "Não foi possível criar o curso gratuito. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/cursos-gratuitos");
  redirect("/admin/cursos-gratuitos");
}

export async function atualizarCursoGratuito(
  id: string,
  fotoPathAtual: string | null,
  _prevState: CursoGratuitoFormState,
  formData: FormData,
): Promise<CursoGratuitoFormState> {
  await requireRole("admin");

  const parsed = parseCursoGratuitoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const { erro: erroFoto, arquivo: arquivoFoto } = validarImagem(formData.get("foto"));
  if (erroFoto) {
    return { errors: { foto: [erroFoto] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let fotoPath = fotoPathAtual;
  let novoPath: string | null = null;
  if (arquivoFoto) {
    const { path, error: uploadError } = await uploadImagem(supabase, CURSOS_BUCKET, arquivoFoto);
    if (uploadError || !path) {
      return { error: "Não foi possível enviar a foto. Tente novamente.", values: echoValues(formData) };
    }
    novoPath = path;
    fotoPath = path;
  }
  const fotoUrl = fotoPath ? supabase.storage.from(CURSOS_BUCKET).getPublicUrl(fotoPath).data.publicUrl : null;

  const { error } = await supabase
    .from("cursos")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      url_plataforma_externa: parsed.data.url_plataforma_externa,
      carga_horaria: parsed.data.carga_horaria ?? null,
      foto_url: fotoUrl,
      foto_path: fotoPath,
      status: parsed.data.status,
    })
    .eq("id", id)
    .eq("gratuito", true);

  if (error) {
    if (novoPath) await supabase.storage.from(CURSOS_BUCKET).remove([novoPath]);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Só remove a foto antiga depois que a nova já está salva — evita ficar sem foto nenhuma se o
  // remove() falhar no meio do caminho. Mesmo padrão de updateCurso (src/app/admin/cursos/actions.ts).
  if (novoPath && fotoPathAtual && fotoPathAtual !== novoPath) {
    await supabase.storage.from(CURSOS_BUCKET).remove([fotoPathAtual]);
  }

  revalidatePath("/admin/cursos-gratuitos");
  redirect("/admin/cursos-gratuitos");
}

// Botão "Remover foto" do formulário de edição — separado de atualizarCursoGratuito porque
// remover a foto é uma ação independente de salvar o resto do formulário (mesmo racional de
// removerFotoAluno em src/app/admin/alunos/actions.ts).
export async function removerFotoCursoGratuito(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();

  const { data: curso } = await supabase
    .from("cursos")
    .select("foto_path")
    .eq("id", id)
    .eq("gratuito", true)
    .maybeSingle();

  if (curso?.foto_path) {
    const { error: storageError } = await supabase.storage.from(CURSOS_BUCKET).remove([curso.foto_path]);
    if (storageError) {
      return { error: "Não foi possível remover o arquivo do Storage. Tente novamente." };
    }
  }

  const { error } = await supabase
    .from("cursos")
    .update({ foto_url: null, foto_path: null })
    .eq("id", id)
    .eq("gratuito", true);

  if (error) {
    return { error: "Arquivo removido do Storage, mas não foi possível atualizar o cadastro. Tente novamente." };
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}

// Toggle rápido de status direto na listagem (coluna "Ativo") — não precisa da página de edição
// completa pra uma mudança binária como essa, mesmo racional de outros toggles rápidos do admin.
export async function atualizarStatusCursoGratuito(id: string, ativo: boolean): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cursos")
    .update({ status: ativo ? "ativo" : "inativo" })
    .eq("id", id)
    .eq("gratuito", true);

  if (error) {
    return { error: "Não foi possível atualizar o status. Tente novamente." };
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}

export async function excluirCursoGratuito(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();

  // gratuito = true na condição: mesmo cuidado de atualizarCursoGratuito acima — esta action só
  // pode agir sobre cursos gratuitos, nunca sobre o catálogo de cursos regulares.
  const { data: curso } = await supabase
    .from("cursos")
    .select("foto_path")
    .eq("id", id)
    .eq("gratuito", true)
    .maybeSingle();

  const { error } = await supabase.from("cursos").delete().eq("id", id).eq("gratuito", true);

  if (error) {
    // 23503 = foreign_key_violation — mesmo código já tratado em deleteCurso
    // (src/app/admin/cursos/actions.ts) pra turmas/leads/matrículas vinculadas.
    if (error.code === "23503") {
      return {
        error: "Não é possível excluir: ainda existem turmas, matrículas ou leads vinculados a este curso.",
      };
    }
    return { error: "Não foi possível excluir o curso gratuito. Tente novamente." };
  }

  // Best-effort: o curso já foi excluído com sucesso acima mesmo se isso falhar — só ficaria um
  // arquivo órfão no Storage (mesma limitação já documentada no CLAUDE.md pra outros buckets).
  if (curso?.foto_path) {
    await supabase.storage.from(CURSOS_BUCKET).remove([curso.foto_path]);
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}

// origem "matricula" = veio de matriculas.curso_bonus_id (escolhido no wizard, preso àquela
// matrícula — sem botão de remover aqui, isso se edita na matrícula). origem "manual" = veio de
// aluno_cursos_gratuitos (atribuído nesta tela — "vinculoId" identifica a linha pra remover).
export type AlunoInscritoCursoGratuito = {
  alunoId: string;
  full_name: string | null;
  cpf: string | null;
  telefone: string | null;
  status: string;
  origem: "matricula" | "manual";
  vinculoId: string | null;
};

// Lista de alunos com acesso a um curso gratuito específico ("Ver detalhes" na tabela) — combina
// as DUAS formas de vínculo que existem hoje: matriculas.curso_bonus_id (bônus de uma matrícula
// paga, ver commit a87616d) e aluno_cursos_gratuitos (atribuição manual, independente de
// matrícula — ver migration 20261022150000). Um aluno pode aparecer via as duas ao mesmo tempo;
// nesse caso aparece 1 vez só, com origem "matricula" (prioridade, porque não tem como remover
// por aqui) e sem vinculoId mesmo que também tenha um vínculo manual.
export async function getAlunosInscritosCursoGratuito(cursoId: string): Promise<AlunoInscritoCursoGratuito[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data: matriculasData }, { data: vinculosData }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("aluno_id, status, alunos(full_name, cpf, telefone)")
      .eq("curso_bonus_id", cursoId),
    supabase
      .from("aluno_cursos_gratuitos")
      .select("id, aluno_id, alunos(full_name, cpf, telefone)")
      .eq("curso_id", cursoId),
  ]);

  const porAluno = new Map<string, AlunoInscritoCursoGratuito>();

  for (const linha of (matriculasData ?? []) as unknown as {
    aluno_id: string;
    status: string;
    alunos: { full_name: string | null; cpf: string | null; telefone: string | null } | null;
  }[]) {
    porAluno.set(linha.aluno_id, {
      alunoId: linha.aluno_id,
      full_name: linha.alunos?.full_name ?? null,
      cpf: linha.alunos?.cpf ?? null,
      telefone: linha.alunos?.telefone ?? null,
      status: linha.status,
      origem: "matricula",
      vinculoId: null,
    });
  }

  for (const linha of (vinculosData ?? []) as unknown as {
    id: string;
    aluno_id: string;
    alunos: { full_name: string | null; cpf: string | null; telefone: string | null } | null;
  }[]) {
    if (porAluno.has(linha.aluno_id)) continue;
    porAluno.set(linha.aluno_id, {
      alunoId: linha.aluno_id,
      full_name: linha.alunos?.full_name ?? null,
      cpf: linha.alunos?.cpf ?? null,
      telefone: linha.alunos?.telefone ?? null,
      status: "atribuído",
      origem: "manual",
      vinculoId: linha.id,
    });
  }

  return Array.from(porAluno.values()).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
}

export type AlunoBuscaResultado = { id: string; full_name: string | null; cpf: string };

// Busca por nome OU CPF (dígitos, sem máscara — cpf no banco é salvo só com números) pra
// autocompletar o campo "Adicionar aluno" no dialog de detalhes. Limite de 10: é autocomplete,
// não listagem. cursoId exclui quem já tem acesso a ESTE curso gratuito (via qualquer uma das
// duas fontes — matrícula bônus ou vínculo manual), pra não sugerir de novo quem já está na lista.
export async function buscarAlunosParaCursoGratuito(termo: string, cursoId: string): Promise<AlunoBuscaResultado[]> {
  await requireRole("admin");

  const termoLimpo = termo.trim();
  if (termoLimpo.length < 2) return [];

  const supabase = await createClient();
  const cpfDigitos = termoLimpo.replace(/\D/g, "");
  const filtro =
    cpfDigitos.length >= 2
      ? `full_name.ilike.%${termoLimpo}%,cpf.ilike.%${cpfDigitos}%`
      : `full_name.ilike.%${termoLimpo}%`;

  const [{ data }, { data: matriculasBonus }, { data: vinculosManuais }] = await Promise.all([
    supabase.from("alunos").select("id, full_name, cpf").or(filtro).limit(10),
    supabase.from("matriculas").select("aluno_id").eq("curso_bonus_id", cursoId),
    supabase.from("aluno_cursos_gratuitos").select("aluno_id").eq("curso_id", cursoId),
  ]);

  const jaVinculados = new Set([
    ...(matriculasBonus ?? []).map((m) => m.aluno_id as string),
    ...(vinculosManuais ?? []).map((v) => v.aluno_id as string),
  ]);

  return ((data ?? []) as AlunoBuscaResultado[]).filter((aluno) => !jaVinculados.has(aluno.id));
}

export async function atribuirCursoGratuito(cursoId: string, alunoId: string): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("aluno_cursos_gratuitos")
    .insert({ curso_id: cursoId, aluno_id: alunoId, created_by: user.id });

  if (error) {
    if (error.code === "23505") {
      return { error: "Este aluno já tem acesso a este curso gratuito." };
    }
    return { error: "Não foi possível vincular o aluno. Tente novamente." };
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}

// Só remove vínculos manuais (aluno_cursos_gratuitos) — um vínculo "origem: matricula" não tem
// vinculoId e esta action nunca é chamada pra ele (botão de remover nem aparece na UI); a
// matrícula principal do aluno nunca é tocada por aqui.
export async function removerVinculoCursoGratuito(vinculoId: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("aluno_cursos_gratuitos").delete().eq("id", vinculoId);

  if (error) {
    return { error: "Não foi possível remover o vínculo. Tente novamente." };
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}
