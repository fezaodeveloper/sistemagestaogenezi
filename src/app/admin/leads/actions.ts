"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  KANBAN_COLUNAS_PROTEGIDAS,
  kanbanColunaCorSchema,
  kanbanColunaNomeSchema,
  kanbanColunaUpdateSchema,
  leadCrmUpdateSchema,
  leadFormSchema,
  leadStatusUpdateSchema,
  registrarFollowupSchema,
  type LeadOrigem,
} from "@/lib/leads/schema";
import { adicionarEntradaNotas, formatarEntradaFollowup } from "@/lib/leads/leads";
import { enviarMensagemLeadRecontato } from "@/lib/mensagens/mensagens";
import { dispararEvento } from "@/lib/automacoes/motor";
import type { LeadFormState } from "@/components/admin/lead-form";
import { ERRO_LOTE_INVALIDO, sanitizarIdsLote, type ResultadoExclusaoLote } from "@/lib/exclusao-em-lote";
import { dispararWebhook } from "@/lib/webhooks/disparar";

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

  dispararWebhook("lead_criado", {
    lead_id: lead.id,
    nome: parsed.data.nome,
    telefone: parsed.data.telefone,
    curso_id: parsed.data.curso_id,
    origem: parsed.data.origem ?? null,
    campanha_origem: null,
  });

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

// Exclusão em lote (seleção múltipla na listagem). O lead É a linha do Kanban
// (kanban_coluna é uma coluna de `leads`), então apagar o lead já o tira do
// Kanban — mesma regra de deleteLead. Se o lote inteiro falhar (ex.: uma FK de
// um único lead), tenta um a um pra não perder os que podem ser excluídos.
export async function deleteLeadsEmLote(ids: string[]): Promise<ResultadoExclusaoLote> {
  await requireRole("admin");

  const validos = sanitizarIdsLote(ids);
  if (!validos) return { excluidos: 0, falhas: [], erro: ERRO_LOTE_INVALIDO };

  const supabase = await createClient();
  let apagados = new Set<string>();

  const { data, error } = await supabase.from("leads").delete().in("id", validos).select("id");
  if (error) {
    for (const id of validos) {
      const { data: um, error: erroUm } = await supabase.from("leads").delete().eq("id", id).select("id");
      if (!erroUm && um?.length) apagados.add(id);
    }
  } else {
    apagados = new Set((data ?? []).map((linha) => linha.id as string));
  }

  revalidatePath("/admin/leads");
  return { excluidos: apagados.size, falhas: validos.filter((id) => !apagados.has(id)) };
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

// ===== CRM Kanban (roadmap, item 3) =====

export async function moverLeadKanban(leadId: string, coluna: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = kanbanColunaUpdateSchema.safeParse({ kanban_coluna: coluna });
  if (!parsed.success) {
    return { error: "Coluna inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ kanban_coluna: parsed.data.kanban_coluna })
    .eq("id", leadId);

  if (error) {
    return { error: error.code === "23503" ? "Coluna inválida." : "Não foi possível mover o lead. Tente novamente." };
  }

  revalidatePath("/admin/leads");
  return {};
}

export async function atualizarLeadCrm(
  leadId: string,
  dados: {
    temperatura: string;
    proxima_acao: string;
    notas: string;
    campanha_origem: string;
    curso_id?: string;
    ultimo_contato?: string;
  },
): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = leadCrmUpdateSchema.safeParse(dados);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const atualizacao: Record<string, string | null> = {
    temperatura: parsed.data.temperatura,
    proxima_acao: parsed.data.proxima_acao ?? null,
    notas: parsed.data.notas ?? null,
    campanha_origem: parsed.data.campanha_origem ?? null,
  };
  // Só toca nesses dois quando o admin mexeu — evita sobrescrever o horário
  // exato do último follow-up (ultimo_followup é timestamptz; o campo do
  // drawer só tem a data) e trocar o curso à toa.
  if (parsed.data.curso_id) atualizacao.curso_id = parsed.data.curso_id;
  if (parsed.data.ultimo_contato !== undefined) {
    // Meio-dia de Brasília: cai no mesmo dia tanto em UTC quanto em BRT.
    atualizacao.ultimo_followup = parsed.data.ultimo_contato
      ? new Date(`${parsed.data.ultimo_contato}T12:00:00-03:00`).toISOString()
      : null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update(atualizacao).eq("id", leadId);

  if (error) {
    // Índice único parcial (telefone + curso, leads em aberto) — trocar o
    // curso pode colidir com outro lead do mesmo telefone.
    return {
      error:
        error.code === "23505"
          ? "Já existe um lead em aberto com esse telefone nesse curso."
          : "Não foi possível salvar. Tente novamente.",
    };
  }

  revalidatePath("/admin/leads");
  return {};
}

// Sem tabela própria de histórico — cada follow-up manual vira uma linha
// datada no topo de notas (mais recente primeiro), ver
// formatarEntradaFollowup/adicionarEntradaNotas em src/lib/leads/leads.ts.
export async function registrarFollowup(leadId: string, nota: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = registrarFollowupSchema.safeParse({ nota });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nota inválida." };
  }

  const supabase = await createClient();
  const { data: leadAtual } = await supabase.from("leads").select("notas").eq("id", leadId).maybeSingle();

  const notasAtualizadas = adicionarEntradaNotas(
    leadAtual?.notas ?? null,
    formatarEntradaFollowup(parsed.data.nota),
  );

  const { error } = await supabase
    .from("leads")
    .update({ notas: notasAtualizadas, ultimo_followup: new Date().toISOString() })
    .eq("id", leadId);

  if (error) {
    return { error: "Não foi possível registrar o follow-up. Tente novamente." };
  }

  revalidatePath("/admin/leads");
  return {};
}

// ===== Combobox de curso do drawer =====

export type CursoBusca = { id: string; nome: string };

// Busca por nome (ilike) nos cursos cadastrados. Termo vazio devolve os
// primeiros em ordem alfabética, pro combobox já abrir com sugestões.
export async function buscarCursos(termo: string): Promise<CursoBusca[]> {
  await requireRole("admin");

  // % e _ são curingas do ilike — o admin digitando "100%" não deve casar tudo.
  const termoSeguro = termo.trim().slice(0, 100).replace(/[\\%_]/g, (caractere) => `\\${caractere}`);

  const supabase = await createClient();
  let query = supabase.from("cursos").select("id, nome").order("nome", { ascending: true }).limit(10);
  if (termoSeguro) query = query.ilike("nome", `%${termoSeguro}%`);

  const { data } = await query;
  return (data ?? []) as CursoBusca[];
}

// ===== Colunas do Kanban (tabela kanban_colunas) =====

export async function criarKanbanColuna(nome: string, cor: string): Promise<{ error?: string; id?: string }> {
  await requireRole("admin");

  const nomeParsed = kanbanColunaNomeSchema.safeParse(nome);
  if (!nomeParsed.success) return { error: nomeParsed.error.issues[0]?.message ?? "Nome inválido." };
  const corParsed = kanbanColunaCorSchema.safeParse(cor);
  if (!corParsed.success) return { error: "Cor inválida." };

  const supabase = await createClient();
  const { data: ultima } = await supabase
    .from("kanban_colunas")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("kanban_colunas")
    .insert({ nome: nomeParsed.data, cor: corParsed.data, ordem: (ultima?.ordem ?? 0) + 1 })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Não foi possível criar a coluna. Tente novamente." };
  }

  revalidatePath("/admin/leads");
  return { id: data.id };
}

export async function renomearKanbanColuna(id: string, nome: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = kanbanColunaNomeSchema.safeParse(nome);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("kanban_colunas").update({ nome: parsed.data }).eq("id", id).select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível renomear a coluna. Tente novamente." };
  }

  revalidatePath("/admin/leads");
  return {};
}

// Só apaga coluna vazia. A contagem aqui é pra devolver mensagem clara; a FK
// (on delete restrict) em leads.kanban_coluna é a trava de banco caso um lead
// caia na coluna entre a contagem e o delete.
export async function excluirKanbanColuna(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  if (KANBAN_COLUNAS_PROTEGIDAS.includes(id)) {
    return { error: "Essa coluna é usada pelo sistema e não pode ser apagada (só renomeada)." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("kanban_coluna", id);

  if (count && count > 0) {
    return { error: `Só é possível apagar colunas vazias. Mova os ${count} lead(s) dessa coluna antes.` };
  }

  const { data, error } = await supabase.from("kanban_colunas").delete().eq("id", id).select("id");

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Só é possível apagar colunas vazias. Mova os leads dessa coluna antes."
          : "Não foi possível apagar a coluna. Tente novamente.",
    };
  }
  if (!data?.length) {
    return { error: "Coluna não encontrada." };
  }

  revalidatePath("/admin/leads");
  return {};
}
