"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { leadFormSchema, leadStatusUpdateSchema, type LeadOrigem } from "@/lib/leads/schema";
import { enviarMensagemLeadRecontato } from "@/lib/mensagens/mensagens";
import { dispararEvento } from "@/lib/automacoes/motor";
import type { LeadFormState } from "@/components/admin/lead-form";

function parseLeadForm(formData: FormData) {
  return leadFormSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone"),
    curso_id: formData.get("curso_id"),
    origem: formData.get("origem"),
    observacoes: formData.get("observacoes") || undefined,
  });
}

// Se a validação falhar, o formulário reaparece com o que a pessoa
// digitou — precisa ser lido bruto do FormData, não de parsed.data (que
// não existe quando safeParse falha).
function echoValues(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? ""),
    telefone: String(formData.get("telefone") ?? ""),
    curso_id: String(formData.get("curso_id") ?? ""),
    origem: (String(formData.get("origem") ?? "") || undefined) as LeadOrigem | undefined,
    observacoes: String(formData.get("observacoes") ?? ""),
  };
}

export async function createLead(_prevState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  await requireRole("admin");

  const parsed = parseLeadForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      curso_id: parsed.data.curso_id,
      origem: parsed.data.origem,
      observacoes: parsed.data.observacoes ?? null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { error: "Não foi possível cadastrar o lead. Tente novamente.", values: echoValues(formData) };
  }

  try {
    const { data: curso } = await supabase
      .from("cursos")
      .select("nome")
      .eq("id", parsed.data.curso_id)
      .single();

    await dispararEvento(
      "lead.novo",
      { nome: parsed.data.nome, telefone: parsed.data.telefone, curso: curso?.nome ?? "—" },
      `lead-novo-${lead.id}`,
    );
  } catch {
    // Best-effort — o lead já foi cadastrado com sucesso acima.
  }

  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}

export async function updateLead(
  id: string,
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  await requireRole("admin");

  const parsed = parseLeadForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      curso_id: parsed.data.curso_id,
      origem: parsed.data.origem,
      observacoes: parsed.data.observacoes ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente.", values: echoValues(formData) };
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}/editar`);
  redirect("/admin/leads");
}

export async function updateLeadStatus(id: string, status: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = leadStatusUpdateSchema.safeParse({ status });
  if (!parsed.success) {
    return { error: "Status inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status: parsed.data.status }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar o status. Tente novamente." };
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}/editar`);
  return {};
}

export async function deleteLead(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o lead." };
  }

  revalidatePath("/admin/leads");
  return {};
}

// Disparo manual (seleção múltipla na listagem) — sempre autorizado pelo
// clique do admin, nunca automático por mudança de status (essa é a regra
// central do CRM: sincronização de status é automática, envio nunca é).
export async function enviarRecontatoLeads(leadIds: string[]): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  if (leadIds.length === 0) {
    return { error: "Selecione ao menos um lead." };
  }

  await Promise.all(leadIds.map((id) => enviarMensagemLeadRecontato(id, user.id)));

  revalidatePath("/admin/mensagens");
  revalidatePath("/admin");
  return {};
}
