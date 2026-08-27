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

export async function getPagamentosAvulsos(ano: number, mes: number): Promise<PagamentoAvulsoComAluno[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { inicio, fim } = iniciosEFimDoMes(ano, mes);

  const { data } = await supabase
    .from("pagamentos_avulsos")
    .select("*, alunos(full_name)")
    .gte("data_pagamento", inicio)
    .lte("data_pagamento", fim)
    .order("data_pagamento", { ascending: false });

  return (data as PagamentoAvulsoComAluno[] | null) ?? [];
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
    tipo: formData.get("tipo"),
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
    tipo: data.tipo,
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
