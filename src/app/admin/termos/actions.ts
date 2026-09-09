"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { extrairTextoPlano } from "@/lib/contratos/schema";
import { formatCpf } from "@/lib/alunos/schema";
import { gerarTermoPdfBuffer } from "@/lib/termos/pdf";
import { termoEditorFormSchema, type Termo } from "@/lib/termos/schema";

export async function getTermos(): Promise<Termo[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("termos").select("*").order("created_at", { ascending: false });
  return (data as Termo[] | null) ?? [];
}

export async function getTermo(id: string): Promise<Termo | null> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("termos").select("*").eq("id", id).single();
  return (data as Termo | null) ?? null;
}

export type TermoActionResult = { success: true } | { error: string };

export type TermoEditorFormState =
  | {
      errors?: Partial<Record<"titulo" | "tipo" | "conteudo_json" | "cor_texto", string[]>>;
      error?: string;
    }
  | undefined;

function parseTermoEditorForm(formData: FormData) {
  return termoEditorFormSchema.safeParse({
    titulo: formData.get("titulo"),
    tipo: formData.get("tipo"),
    conteudo_json: formData.get("conteudo_json"),
    cor_texto: formData.get("cor_texto"),
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarTermo(
  _prevState: TermoEditorFormState,
  formData: FormData,
): Promise<TermoEditorFormState> {
  await requireRole("admin");

  const parsed = parseTermoEditorForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("termos").insert({
    titulo: parsed.data.titulo,
    tipo: parsed.data.tipo,
    conteudo: extrairTextoPlano(parsed.data.conteudo_json),
    conteudo_json: parsed.data.conteudo_json,
    cor_texto: parsed.data.cor_texto,
    ativo: parsed.data.ativo,
  });

  if (error) {
    return { error: "Não foi possível criar o termo. Tente novamente." };
  }

  revalidatePath("/admin/termos");
  redirect("/admin/termos");
}

export async function atualizarTermo(
  id: string,
  _prevState: TermoEditorFormState,
  formData: FormData,
): Promise<TermoEditorFormState> {
  await requireRole("admin");

  const parsed = parseTermoEditorForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("termos")
    .update({
      titulo: parsed.data.titulo,
      tipo: parsed.data.tipo,
      conteudo: extrairTextoPlano(parsed.data.conteudo_json),
      conteudo_json: parsed.data.conteudo_json,
      cor_texto: parsed.data.cor_texto,
      ativo: parsed.data.ativo,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/termos");
  redirect("/admin/termos");
}

export async function excluirTermo(id: string): Promise<TermoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("termos").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o termo. Tente novamente." };
  }

  revalidatePath("/admin/termos");
  return { success: true };
}

export type TermoPdfResult = { pdf: string } | { error: string };

// alunoId opcional: sem ele, gera uma prévia genérica (botão "Visualizar
// PDF" na lista) — com ele, preenche as variáveis do aluno e a data de
// aceite (uso futuro, quando existir um fluxo de aceite pelo aluno).
export async function gerarTermoPdf(termoId: string, alunoId?: string): Promise<TermoPdfResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: termoData } = await supabase.from("termos").select("*").eq("id", termoId).single();
  if (!termoData) {
    return { error: "Termo não encontrado." };
  }
  const termo = termoData as Termo;

  const { data: configuracoes } = await supabase
    .from("configuracoes")
    .select("escola_nome")
    .eq("id", true)
    .single();
  const nomeEscola = configuracoes?.escola_nome ?? "GÊNEZI Educação Profissional";
  const hoje = new Date().toLocaleDateString("pt-BR");

  const variaveis: Record<string, string> = {
    nome_aluno: "—",
    cpf_aluno: "—",
    email_aluno: "—",
    data_aceite: "—",
    nome_escola: nomeEscola,
    data_termo: hoje,
  };

  let nomeAssinatura: string | null = null;
  let dataAceite: string | null = null;

  if (alunoId) {
    const { data: alunoData } = await supabase
      .from("alunos")
      .select("cpf, email, profiles!alunos_id_fkey(full_name)")
      .eq("id", alunoId)
      .maybeSingle();

    const aluno = alunoData as unknown as {
      cpf: string;
      email: string;
      profiles: { full_name: string | null } | null;
    } | null;

    if (aluno) {
      nomeAssinatura = aluno.profiles?.full_name ?? null;
      dataAceite = hoje;
      variaveis.nome_aluno = nomeAssinatura ?? "—";
      variaveis.cpf_aluno = aluno.cpf ? formatCpf(aluno.cpf) : "—";
      variaveis.email_aluno = aluno.email ?? "—";
      variaveis.data_aceite = hoje;
    }
  }

  const pdfBuffer = await gerarTermoPdfBuffer(termo, variaveis, nomeEscola, nomeAssinatura, dataAceite);
  return { pdf: pdfBuffer.toString("base64") };
}
