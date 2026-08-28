"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  manutencaoChamadoFormSchema,
  manutencaoResolucaoFormSchema,
  MANUTENCAO_STATUSES,
  MANUTENCAO_STATUSES_ENCERRADOS,
  type ManutencaoChamado,
  type ManutencaoStatus,
} from "@/lib/manutencao/schema";

export async function getManutencaoChamados(): Promise<ManutencaoChamado[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("manutencao_chamados")
    .select("*")
    .order("created_at", { ascending: false });

  return (data as ManutencaoChamado[] | null) ?? [];
}

export async function createManutencaoChamado(formData: FormData): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = manutencaoChamadoFormSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    local: formData.get("local") || undefined,
    prioridade: formData.get("prioridade"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("manutencao_chamados").insert({
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao ?? null,
    local: parsed.data.local ?? null,
    prioridade: parsed.data.prioridade,
  });

  if (error) {
    return { error: "Não foi possível registrar o chamado. Tente novamente." };
  }

  revalidatePath("/admin/manutencao");
  revalidatePath("/admin/pendencias");
  return {};
}

// Transições rápidas de status ("Em andamento", "Cancelar") — resolver tem
// função própria abaixo, porque exige o campo observacoes_resolucao.
export async function atualizarStatusChamado(
  id: string,
  status: Extract<ManutencaoStatus, "em_andamento" | "cancelado">,
): Promise<{ error?: string }> {
  await requireRole("admin");

  if (!MANUTENCAO_STATUSES.includes(status)) {
    return { error: "Status inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("manutencao_chamados").update({ status }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar o chamado." };
  }

  revalidatePath("/admin/manutencao");
  revalidatePath("/admin/pendencias");
  return {};
}

export async function resolverChamado(id: string, formData: FormData): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = manutencaoResolucaoFormSchema.safeParse({
    observacoes_resolucao: formData.get("observacoes_resolucao"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("manutencao_chamados")
    .update({
      status: "resolvido",
      resolvido_em: new Date().toISOString(),
      observacoes_resolucao: parsed.data.observacoes_resolucao,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível resolver o chamado." };
  }

  revalidatePath("/admin/manutencao");
  revalidatePath("/admin/pendencias");
  return {};
}

export async function deleteManutencaoChamado(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: chamado } = await supabase
    .from("manutencao_chamados")
    .select("status")
    .eq("id", id)
    .single();

  if (!chamado || !MANUTENCAO_STATUSES_ENCERRADOS.includes(chamado.status)) {
    return { error: "Só é possível excluir chamados resolvidos ou cancelados." };
  }

  const { error } = await supabase.from("manutencao_chamados").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o chamado." };
  }

  revalidatePath("/admin/manutencao");
  return {};
}
