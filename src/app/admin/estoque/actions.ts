"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, LIMITE_PADRAO } from "@/lib/paginacao";
import {
  estoqueItemFormSchema,
  estoqueMovimentacaoFormSchema,
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

  const { error: movError } = await supabase.from("estoque_movimentacoes").insert({
    item_id: itemId,
    tipo: parsed.data.tipo,
    quantidade: parsed.data.quantidade,
    motivo: parsed.data.motivo ?? null,
  });

  if (movError) {
    return { error: "Quantidade atualizada, mas não foi possível registrar a movimentação." };
  }

  revalidatePath("/admin/estoque");
  return {};
}
