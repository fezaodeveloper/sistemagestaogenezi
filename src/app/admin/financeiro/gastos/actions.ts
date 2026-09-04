"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { gastoFormSchema, type Gasto } from "@/lib/financeiro/schema";

function iniciosEFimDoMes(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

export type GastosPaginados = { itens: Gasto[]; total: number };

export async function getGastos(
  ano: number,
  mes: number,
  dataInicio?: string,
  dataFim?: string,
  page = 1,
  limit = 20,
  query?: string,
): Promise<GastosPaginados> {
  await requireRole("admin");
  const supabase = await createClient();
  const { inicio, fim } =
    dataInicio && dataFim ? { inicio: dataInicio, fim: dataFim } : iniciosEFimDoMes(ano, mes);
  const offset = (page - 1) * limit;

  let consulta = supabase
    .from("gastos")
    .select("*", { count: "exact" })
    .gte("data_gasto", inicio)
    .lte("data_gasto", fim);

  const termo = query?.trim();
  if (termo) {
    consulta = consulta.ilike("descricao", `%${termo}%`);
  }

  const { data, count } = await consulta
    .order("data_gasto", { ascending: false })
    .range(offset, offset + limit - 1);

  return { itens: (data as Gasto[] | null) ?? [], total: count ?? 0 };
}

export type GastoActionResult = { success: true } | { error: string };

export async function criarGasto(formData: FormData): Promise<GastoActionResult> {
  await requireRole("admin");

  const parsed = gastoFormSchema.safeParse({
    descricao: formData.get("descricao"),
    categoria_id: formData.get("categoria_id"),
    valor: Number(formData.get("valor")),
    data_gasto: formData.get("data_gasto"),
    forma_pagamento: formData.get("forma_pagamento") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    recorrente: formData.get("recorrente") === "on",
  });

  console.log('parsed result:', JSON.stringify(parsed, null, 2));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("gastos").insert({
    descricao: data.descricao,
    categoria_id: data.categoria_id,
    valor: data.valor,
    data_gasto: data.data_gasto,
    forma_pagamento: data.forma_pagamento ?? null,
    observacoes: data.observacoes ?? null,
    recorrente: data.recorrente,
  });

  console.log('supabase error:', JSON.stringify(error, null, 2));

  if (error) {
    return { error: `Erro: ${error.message} (código: ${error.code})` };
  }

  revalidatePath("/admin/financeiro/gastos");
  return { success: true };
}

export async function atualizarGasto(id: string, formData: FormData): Promise<GastoActionResult> {
  await requireRole("admin");

  const parsed = gastoFormSchema.safeParse({
    descricao: formData.get("descricao"),
    categoria_id: formData.get("categoria_id"),
    valor: Number(formData.get("valor")),
    data_gasto: formData.get("data_gasto"),
    forma_pagamento: formData.get("forma_pagamento") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    recorrente: formData.get("recorrente") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("gastos")
    .update({
      descricao: data.descricao,
      categoria_id: data.categoria_id,
      valor: data.valor,
      data_gasto: data.data_gasto,
      forma_pagamento: data.forma_pagamento ?? null,
      observacoes: data.observacoes ?? null,
      recorrente: data.recorrente,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/financeiro/gastos");
  return { success: true };
}

export async function excluirGasto(id: string): Promise<GastoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("gastos").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o gasto. Tente novamente." };
  }

  revalidatePath("/admin/financeiro/gastos");
  return { success: true };
}
