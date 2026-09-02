"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { pagamentoAvulsoFormSchema, type PagamentoAvulso } from "@/lib/financeiro/schema";

function iniciosEFimDoMes(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

export type PagamentoAvulsoComAluno = PagamentoAvulso & {
  alunos: { full_name: string | null } | null;
};

export type PagamentosAvulsosPaginados = { itens: PagamentoAvulsoComAluno[]; total: number };

export async function getPagamentosAvulsos(
  ano: number,
  mes: number,
  dataInicio?: string,
  dataFim?: string,
  page = 1,
  limit = 20,
  query?: string,
): Promise<PagamentosAvulsosPaginados> {
  await requireRole("admin");
  const supabase = await createClient();
  const { inicio, fim } =
    dataInicio && dataFim ? { inicio: dataInicio, fim: dataFim } : iniciosEFimDoMes(ano, mes);
  const offset = (page - 1) * limit;

  let consulta = supabase
    .from("pagamentos_avulsos")
    .select("*, alunos(full_name)", { count: "exact" })
    .gte("data_pagamento", inicio)
    .lte("data_pagamento", fim);

  const termo = query?.trim();
  if (termo) {
    consulta = consulta.ilike("descricao", `%${termo}%`);
  }

  const { data, count } = await consulta
    .order("data_pagamento", { ascending: false })
    .range(offset, offset + limit - 1);

  return { itens: (data as PagamentoAvulsoComAluno[] | null) ?? [], total: count ?? 0 };
}

export type AlunoOpcao = { id: string; full_name: string | null };

export async function getAlunosParaPagamentoAvulso(): Promise<AlunoOpcao[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("alunos").select("id, full_name").order("full_name");
  return (data as AlunoOpcao[] | null) ?? [];
}

export type PagamentoAvulsoActionResult = { success: true } | { error: string };

export async function criarPagamentoAvulso(formData: FormData): Promise<PagamentoAvulsoActionResult> {
  await requireRole("admin");

  const alunoIdRaw = formData.get("aluno_id");

  const parsed = pagamentoAvulsoFormSchema.safeParse({
    descricao: formData.get("descricao"),
    valor: Number(formData.get("valor")),
    data_pagamento: formData.get("data_pagamento"),
    categoria_id: formData.get("categoria_id"),
    forma_pagamento: formData.get("forma_pagamento") || null,
    aluno_id: alunoIdRaw || null,
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos_avulsos").insert({
    descricao: data.descricao,
    valor: data.valor,
    data_pagamento: data.data_pagamento,
    categoria_id: data.categoria_id,
    forma_pagamento: data.forma_pagamento,
    aluno_id: data.aluno_id ?? null,
    observacoes: data.observacoes ?? null,
  });

  if (error) {
    return { error: "Não foi possível registrar o pagamento. Tente novamente." };
  }

  revalidatePath("/admin/financeiro/avulsos");
  return { success: true };
}

export async function atualizarPagamentoAvulso(
  id: string,
  formData: FormData,
): Promise<PagamentoAvulsoActionResult> {
  await requireRole("admin");

  const alunoIdRaw = formData.get("aluno_id");

  const parsed = pagamentoAvulsoFormSchema.safeParse({
    descricao: formData.get("descricao"),
    valor: Number(formData.get("valor")),
    data_pagamento: formData.get("data_pagamento"),
    categoria_id: formData.get("categoria_id"),
    forma_pagamento: formData.get("forma_pagamento") || null,
    aluno_id: alunoIdRaw || null,
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_avulsos")
    .update({
      descricao: data.descricao,
      valor: data.valor,
      data_pagamento: data.data_pagamento,
      categoria_id: data.categoria_id,
      forma_pagamento: data.forma_pagamento,
      aluno_id: data.aluno_id ?? null,
      observacoes: data.observacoes ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/financeiro/avulsos");
  return { success: true };
}

export async function excluirPagamentoAvulso(id: string): Promise<PagamentoAvulsoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("pagamentos_avulsos").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o pagamento. Tente novamente." };
  }

  revalidatePath("/admin/financeiro/avulsos");
  return { success: true };
}
