"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { enviarPushAlunos } from "@/lib/push/enviar";
import {
  notificacaoPushSchema,
  pushAgendamentoSchema,
  pushTemplateSchema,
  type PushAgendamentoDestinatario,
  type PushTemplateTipo,
} from "@/lib/push/schema";

export type EnviarNotificacaoResultado = { success: true; quantidade: number } | { error: string };

export async function enviarNotificacaoPush(formData: FormData): Promise<EnviarNotificacaoResultado> {
  await requireRole("admin");

  const parsed = notificacaoPushSchema.safeParse({
    titulo: formData.get("titulo"),
    corpo: formData.get("corpo"),
    url: formData.get("url"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const quantidade = await enviarPushAlunos(parsed.data.titulo, parsed.data.corpo, parsed.data.url);
  return { success: true, quantidade };
}

// ===== Templates =====
//
// Tipo de resultado próprio (não ParcelaActionResult, de src/app/admin/financeiro/actions.ts —
// esse tipo é de um domínio diferente, importar de lá só por coincidência de shape seria
// confuso). Mesmo formato ({success:true}|{error:string}), só nomeado e definido aqui.
type ActionResult = { success: true } | { error: string };

export type PushTemplate = {
  id: string;
  nome: string;
  titulo: string;
  corpo: string;
  tipo: PushTemplateTipo;
  ativo: boolean;
  created_at: string;
};

export async function listarTemplates(): Promise<PushTemplate[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("push_templates").select("*").order("nome");
  return (data as PushTemplate[] | null) ?? [];
}

export async function criarTemplate(dados: {
  nome: string;
  titulo: string;
  corpo: string;
  tipo: string;
  ativo: boolean;
}): Promise<ActionResult> {
  await requireRole("admin");

  const parsed = pushTemplateSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_templates").insert(parsed.data);
  if (error) return { error: "Não foi possível criar o template." };

  revalidatePath("/admin/notificacoes");
  return { success: true };
}

export async function atualizarTemplate(
  id: string,
  dados: { nome: string; titulo: string; corpo: string; tipo: string; ativo: boolean },
): Promise<ActionResult> {
  await requireRole("admin");

  const parsed = pushTemplateSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_templates").update(parsed.data).eq("id", id);
  if (error) return { error: "Não foi possível atualizar o template." };

  revalidatePath("/admin/notificacoes");
  return { success: true };
}

// Toggle rápido do switch "Ativo" na tabela — sem passar pelo formulário completo.
export async function alternarTemplateAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("push_templates").update({ ativo }).eq("id", id);
  if (error) return { error: "Não foi possível atualizar o template." };

  revalidatePath("/admin/notificacoes");
  return { success: true };
}

export async function excluirTemplate(id: string): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("push_templates").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o template." };

  revalidatePath("/admin/notificacoes");
  return { success: true };
}

// ===== Agendamentos =====

export type PushAgendamento = {
  id: string;
  template_id: string | null;
  titulo: string;
  corpo: string;
  destinatarios: PushAgendamentoDestinatario;
  turma_id: string | null;
  agendado_para: string;
  enviado_em: string | null;
  total_enviado: number | null;
  created_at: string;
  template_nome: string | null;
  turma_nome: string | null;
};

type LinhaAgendamento = {
  id: string;
  template_id: string | null;
  titulo: string;
  corpo: string;
  destinatarios: PushAgendamentoDestinatario;
  turma_id: string | null;
  agendado_para: string;
  enviado_em: string | null;
  total_enviado: number | null;
  created_at: string;
  push_templates: { nome: string } | null;
  turmas: { nome: string } | null;
};

export async function listarAgendamentos(): Promise<PushAgendamento[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("push_agendamentos")
    .select(
      "id, template_id, titulo, corpo, destinatarios, turma_id, agendado_para, enviado_em, total_enviado, created_at, push_templates(nome), turmas(nome)",
    )
    .order("agendado_para", { ascending: false });

  return ((data ?? []) as unknown as LinhaAgendamento[]).map((linha) => ({
    id: linha.id,
    template_id: linha.template_id,
    titulo: linha.titulo,
    corpo: linha.corpo,
    destinatarios: linha.destinatarios,
    turma_id: linha.turma_id,
    agendado_para: linha.agendado_para,
    enviado_em: linha.enviado_em,
    total_enviado: linha.total_enviado,
    created_at: linha.created_at,
    template_nome: linha.push_templates?.nome ?? null,
    turma_nome: linha.turmas?.nome ?? null,
  }));
}

export async function listarTurmasAtivas(): Promise<{ id: string; nome: string }[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("turmas").select("id, nome").eq("status", "ativa").order("nome");
  return (data as { id: string; nome: string }[] | null) ?? [];
}

export async function criarAgendamento(dados: {
  templateId: string | null;
  titulo: string;
  corpo: string;
  destinatarios: string;
  turmaId: string | null;
  agendadoPara: string;
}): Promise<ActionResult> {
  await requireRole("admin");

  const parsed = pushAgendamentoSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const valores = parsed.data;

  // Horário digitado é de Brasília (America/Sao_Paulo, UTC-3 o ano todo desde 2019) — mesmo
  // critério já usado por agendarCampanha (src/app/admin/email-marketing/actions.ts).
  const quando = new Date(`${valores.agendadoPara}:00-03:00`);
  if (Number.isNaN(quando.getTime())) return { error: "Data/hora inválida." };
  if (quando.getTime() < Date.now() + 60_000) return { error: "Escolha um horário no futuro." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_agendamentos").insert({
    template_id: valores.templateId,
    titulo: valores.titulo,
    corpo: valores.corpo,
    destinatarios: valores.destinatarios,
    turma_id: valores.destinatarios === "turma" ? valores.turmaId : null,
    agendado_para: quando.toISOString(),
  });
  if (error) return { error: "Não foi possível criar o agendamento." };

  revalidatePath("/admin/notificacoes");
  return { success: true };
}

export async function cancelarAgendamento(id: string): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_agendamentos")
    .delete()
    .eq("id", id)
    .is("enviado_em", null)
    .select("id");
  if (error) return { error: "Não foi possível cancelar o agendamento." };
  if (!data?.length) return { error: "Este agendamento já foi enviado e não pode ser cancelado." };

  revalidatePath("/admin/notificacoes");
  return { success: true };
}
