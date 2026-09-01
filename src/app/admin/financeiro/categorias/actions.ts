"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Duas tabelas (categorias_gastos / categorias_avulsos) com CRUD idêntico —
// parametrizadas por "tabela" em vez de duplicar 4 Server Actions duas
// vezes. A tabela de registros vinculados (usada só na exclusão, pra
// checar se a categoria pode ser removida) é derivada da própria tabela de
// categoria, não recebida à parte.
type TabelaCategoria = "categorias_gastos" | "categorias_avulsos";
type TabelaRegistros = "gastos" | "pagamentos_avulsos";

const REGISTROS_POR_CATEGORIA: Record<TabelaCategoria, TabelaRegistros> = {
  categorias_gastos: "gastos",
  categorias_avulsos: "pagamentos_avulsos",
};

export type Categoria = {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  ordem: number;
};

export async function getCategorias(tabela: TabelaCategoria): Promise<Categoria[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from(tabela).select("id, nome, cor, ativo, ordem").order("ordem");
  return (data as Categoria[] | null) ?? [];
}

export type CategoriaActionResult = { success: true } | { error: string };

export async function criarCategoria(
  tabela: TabelaCategoria,
  nome: string,
  cor: string,
): Promise<CategoriaActionResult> {
  await requireRole("admin");

  const nomeTrim = nome.trim();
  if (!nomeTrim) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { data: ultima } = await supabase
    .from(tabela)
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ultima?.ordem ?? 0) + 1;

  const { error } = await supabase.from(tabela).insert({ nome: nomeTrim, cor, ordem });
  if (error) return { error: "Não foi possível criar a categoria. Tente novamente." };

  revalidatePath("/admin/financeiro/categorias");
  return { success: true };
}

export async function atualizarCategoria(
  tabela: TabelaCategoria,
  id: string,
  dados: { nome: string; cor: string; ativo: boolean },
): Promise<CategoriaActionResult> {
  await requireRole("admin");

  const nomeTrim = dados.nome.trim();
  if (!nomeTrim) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(tabela)
    .update({ nome: nomeTrim, cor: dados.cor, ativo: dados.ativo })
    .eq("id", id);

  if (error) return { error: "Não foi possível salvar a categoria. Tente novamente." };

  revalidatePath("/admin/financeiro/categorias");
  return { success: true };
}

export async function reordenarCategoria(
  tabela: TabelaCategoria,
  id: string,
  direcao: "cima" | "baixo",
): Promise<CategoriaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data } = await supabase.from(tabela).select("id, ordem").order("ordem");
  const lista = data ?? [];
  const index = lista.findIndex((categoria) => categoria.id === id);
  if (index === -1) return { error: "Categoria não encontrada." };

  const indexAlvo = direcao === "cima" ? index - 1 : index + 1;
  if (indexAlvo < 0 || indexAlvo >= lista.length) return { success: true };

  const atual = lista[index];
  const alvo = lista[indexAlvo];

  // Troca simples de `ordem` entre os dois vizinhos — não precisa
  // renumerar a lista inteira pra mover um item uma posição.
  const [{ error: erroAtual }, { error: erroAlvo }] = await Promise.all([
    supabase.from(tabela).update({ ordem: alvo.ordem }).eq("id", atual.id),
    supabase.from(tabela).update({ ordem: atual.ordem }).eq("id", alvo.id),
  ]);

  if (erroAtual || erroAlvo) return { error: "Não foi possível reordenar as categorias." };

  revalidatePath("/admin/financeiro/categorias");
  return { success: true };
}

export async function excluirCategoria(
  tabela: TabelaCategoria,
  id: string,
): Promise<CategoriaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const tabelaRegistros = REGISTROS_POR_CATEGORIA[tabela];
  const { count } = await supabase
    .from(tabelaRegistros)
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);

  if ((count ?? 0) > 0) {
    return { error: "Não é possível excluir: existem registros vinculados a essa categoria." };
  }

  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir a categoria. Tente novamente." };

  revalidatePath("/admin/financeiro/categorias");
  return { success: true };
}
