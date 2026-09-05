"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, LIMITE_PADRAO } from "@/lib/paginacao";
import {
  estoqueItemFormSchema,
  estoqueMovimentacaoFormSchema,
  type EstoqueEntrega,
  type EstoqueItem,
} from "@/lib/estoque/schema";

export async function getEstoqueItens(options?: {
  query?: string;
  page?: number;
  limit?: number;
}): Promise<{ itens: EstoqueItem[]; total: number }> {
  await requireRole("admin");

  const pagina = options?.page ?? 1;
  const limite = options?.limit ?? LIMITE_PADRAO;
  const offset = calcularOffset(pagina, limite);

  const supabase = await createClient();
  let query = supabase.from("estoque_itens").select("*", { count: "exact" });
  if (options?.query) {
    query = query.ilike("nome", `%${options.query}%`);
  }

  const { data, count } = await query.order("nome").range(offset, offset + limite - 1);

  return { itens: (data as EstoqueItem[] | null) ?? [], total: count ?? 0 };
}

export async function getEstoqueItem(id: string): Promise<EstoqueItem | null> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("estoque_itens").select("*").eq("id", id).single();

  return (data as EstoqueItem | null) ?? null;
}

export type EstoqueItemFormValuesEcho = {
  nome: string;
  categoria: string;
  quantidade_atual: string;
  quantidade_minima: string;
  unidade: string;
  observacoes: string;
};

export type EstoqueItemFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      error?: string;
      values?: EstoqueItemFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): EstoqueItemFormValuesEcho {
  return {
    nome: String(formData.get("nome") ?? ""),
    categoria: String(formData.get("categoria") ?? ""),
    quantidade_atual: String(formData.get("quantidade_atual") ?? ""),
    quantidade_minima: String(formData.get("quantidade_minima") ?? ""),
    unidade: String(formData.get("unidade") ?? ""),
    observacoes: String(formData.get("observacoes") ?? ""),
  };
}

function parseEstoqueItemForm(formData: FormData) {
  return estoqueItemFormSchema.safeParse({
    nome: formData.get("nome"),
    categoria: formData.get("categoria"),
    quantidade_atual: formData.get("quantidade_atual"),
    quantidade_minima: formData.get("quantidade_minima"),
    unidade: formData.get("unidade"),
    observacoes: formData.get("observacoes") || undefined,
  });
}

export async function createEstoqueItem(
  _prevState: EstoqueItemFormState,
  formData: FormData,
): Promise<EstoqueItemFormState> {
  await requireRole("admin");

  const parsed = parseEstoqueItemForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("estoque_itens").insert({
    nome: parsed.data.nome,
    categoria: parsed.data.categoria,
    quantidade_atual: parsed.data.quantidade_atual,
    quantidade_minima: parsed.data.quantidade_minima,
    unidade: parsed.data.unidade,
    observacoes: parsed.data.observacoes ?? null,
  });

  if (error) {
    return { error: "Não foi possível cadastrar o item. Tente novamente.", values: echoValues(formData) };
  }

  revalidatePath("/admin/estoque");
  redirect("/admin/estoque");
}

export async function updateEstoqueItem(
  id: string,
  _prevState: EstoqueItemFormState,
  formData: FormData,
): Promise<EstoqueItemFormState> {
  await requireRole("admin");

  const parsed = parseEstoqueItemForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("estoque_itens")
    .update({
      nome: parsed.data.nome,
      categoria: parsed.data.categoria,
      quantidade_atual: parsed.data.quantidade_atual,
      quantidade_minima: parsed.data.quantidade_minima,
      unidade: parsed.data.unidade,
      observacoes: parsed.data.observacoes ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente.", values: echoValues(formData) };
  }

  revalidatePath("/admin/estoque");
  redirect("/admin/estoque");
}

export async function deleteEstoqueItem(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("estoque_itens").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o item." };
  }

  revalidatePath("/admin/estoque");
  return {};
}

export async function registrarMovimentacao(
  itemId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = estoqueMovimentacaoFormSchema.safeParse({
    tipo: formData.get("tipo"),
    quantidade: formData.get("quantidade"),
    motivo: formData.get("motivo") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("estoque_itens")
    .select("quantidade_atual")
    .eq("id", itemId)
    .single();

  if (!item) {
    return { error: "Item não encontrado." };
  }

  let novaQuantidade = item.quantidade_atual;
  if (parsed.data.tipo === "entrada") novaQuantidade += parsed.data.quantidade;
  else if (parsed.data.tipo === "saida") novaQuantidade -= parsed.data.quantidade;
  else novaQuantidade = parsed.data.quantidade;

  if (novaQuantidade < 0) {
    return { error: "Quantidade insuficiente em estoque para essa saída." };
  }

  const { error: updateError } = await supabase
    .from("estoque_itens")
    .update({ quantidade_atual: novaQuantidade })
    .eq("id", itemId);

  if (updateError) {
    return { error: "Não foi possível atualizar a quantidade." };
  }

  // aluno_id/aluno_nome_cache só fazem sentido numa saída (entrega pro
  // aluno) — ignorados silenciosamente pra entrada/ajuste, mesmo se
  // vierem preenchidos no FormData por engano.
  const alunoId = formData.get("aluno_id");
  const alunoNomeCache = formData.get("aluno_nome_cache");
  const ehEntregaParaAluno = parsed.data.tipo === "saida" && alunoId;

  const { error: movError } = await supabase.from("estoque_movimentacoes").insert({
    item_id: itemId,
    tipo: parsed.data.tipo,
    quantidade: parsed.data.quantidade,
    motivo: parsed.data.motivo ?? null,
    aluno_id: ehEntregaParaAluno ? String(alunoId) : null,
    aluno_nome_cache: ehEntregaParaAluno ? String(alunoNomeCache ?? "") || null : null,
  });

  if (movError) {
    return { error: "Quantidade atualizada, mas não foi possível registrar a movimentação." };
  }

  revalidatePath("/admin/estoque");
  return {};
}

// Alunos ativos por nome — mesmo padrão de buscarAlunosParaWizard
// (src/app/admin/matriculas/actions.ts): só dispara com 2+ caracteres,
// LIMIT 10, usado no campo "Aluno (opcional)" da saída de estoque.
export async function buscarAlunosParaEntrega(
  query: string,
): Promise<{ id: string; full_name: string | null }[]> {
  await requireRole("admin");

  const termo = query.trim();
  if (termo.length < 2) return [];

  const termoSeguro = termo.replace(/[,()]/g, "").trim();
  if (!termoSeguro) return [];
  const termoLike = `%${termoSeguro}%`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("alunos")
    .select("id, full_name")
    .eq("status_aluno", "ativo")
    .ilike("full_name", termoLike)
    .order("full_name")
    .limit(10);

  return data ?? [];
}

export async function getEstoqueEntregas(options?: {
  query?: string;
  page?: number;
  limit?: number;
}): Promise<{ entregas: EstoqueEntrega[]; total: number }> {
  await requireRole("admin");

  const pagina = options?.page ?? 1;
  const limite = options?.limit ?? LIMITE_PADRAO;
  const offset = calcularOffset(pagina, limite);

  const supabase = await createClient();
  // !inner no embed de estoque_itens permite filtrar por estoque_itens.nome
  // dentro do .or() abaixo — sem inner join, o PostgREST não aplica esse
  // filtro embutido ao conjunto de linhas retornado.
  let query = supabase
    .from("estoque_movimentacoes")
    .select("*, estoque_itens!inner(nome, categoria)", { count: "exact" })
    .eq("tipo", "saida")
    .not("aluno_id", "is", null);

  if (options?.query) {
    const termoSeguro = options.query.replace(/[,()]/g, "").trim();
    if (termoSeguro) {
      const termoLike = `%${termoSeguro}%`;
      query = query.or(
        `aluno_nome_cache.ilike.${termoLike},estoque_itens.nome.ilike.${termoLike}`,
      );
    }
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);

  return { entregas: (data as EstoqueEntrega[] | null) ?? [], total: count ?? 0 };
}

export async function atualizarObservacaoEntrega(
  id: string,
  motivo: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("estoque_movimentacoes")
    .update({ motivo: motivo.trim() || null })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar a observação." };
  }

  revalidatePath("/admin/estoque/entregas");
  return {};
}

// Exclui só o registro histórico da entrega — não repõe a quantidade no
// estoque (a saída já aconteceu de fato; reverter automaticamente a
// quantidade poderia mascarar um ajuste manual feito à parte). Se o item
// tiver que voltar pro estoque, use "Entrada" na tela de Estoque.
export async function excluirEntrega(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("estoque_movimentacoes").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o registro." };
  }

  revalidatePath("/admin/estoque/entregas");
  return {};
}
