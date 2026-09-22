"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { executarFluxo } from "@/lib/whatsapp/fluxos";
import { isFluxoGatilho, nosIniciais, parseNos, type NoFluxo } from "@/lib/whatsapp/fluxos-tipos";
import { normalizarTelefone } from "@/lib/mensagens/texto";

type Resultado = { success: true } | { error: string };

function revalidarLista() {
  revalidatePath("/admin/whatsapp-fluxos");
}
function revalidarFluxo(id: string) {
  revalidatePath(`/admin/whatsapp-fluxos/${id}`);
}

// ===== Criar / duplicar / excluir / ativar =====

const criarSchema = z.object({
  nome: z.string().trim().min(1, { error: "Informe o nome do fluxo." }).max(100),
  descricao: z.string().trim().max(500),
  gatilho: z.string().refine(isFluxoGatilho, { error: "Gatilho inválido." }),
});

export async function criarFluxo(dados: { nome: string; descricao: string; gatilho: string }): Promise<Resultado & { id?: string }> {
  const user = await requireRole("admin");

  const parsed = criarSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_fluxos")
    .insert({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao || null,
      gatilho: parsed.data.gatilho,
      nos: nosIniciais(parsed.data.gatilho),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o fluxo. Confira se a migration whatsapp_fluxos foi aplicada." };

  revalidarLista();
  return { success: true, id: data.id as string };
}

export async function duplicarFluxo(id: string): Promise<Resultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Fluxo inválido." };

  const supabase = await createClient();
  const { data: original } = await supabase.from("whatsapp_fluxos").select("nome, descricao, gatilho, nos").eq("id", id).maybeSingle();
  if (!original) return { error: "Fluxo não encontrado." };

  const { error } = await supabase.from("whatsapp_fluxos").insert({
    nome: `${original.nome} (cópia)`.slice(0, 100),
    descricao: original.descricao,
    gatilho: original.gatilho,
    ativo: false,
    nos: original.nos,
  });
  if (error) return { error: "Não foi possível duplicar o fluxo." };

  revalidarLista();
  return { success: true };
}

export async function excluirFluxo(id: string): Promise<Resultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Fluxo inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_fluxos").delete().eq("id", id).select("id");
  if (error) return { error: "Não foi possível excluir o fluxo." };
  if (!data?.length) return { error: "Fluxo não encontrado." };

  revalidarLista();
  return { success: true };
}

export async function alternarFluxoAtivo(id: string, ativo: boolean): Promise<Resultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Fluxo inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_fluxos").update({ ativo }).eq("id", id).select("id");
  if (error) return { error: "Não foi possível atualizar o fluxo." };
  if (!data?.length) return { error: "Fluxo não encontrado." };

  revalidarLista();
  return { success: true };
}

// ===== Editor (canvas) =====

const noSchema = z.object({
  id: z.string().min(1).max(40),
  tipo: z.enum(["gatilho", "mensagem", "aguardar", "condicao", "fim"]),
  posicao: z.object({ x: z.number(), y: z.number() }),
  dados: z.record(z.string(), z.unknown()),
  proximos: z.array(z.string()).max(2),
});

export async function salvarNosFluxo(id: string, nomeAtual: { nome: string; descricao: string }, nos: NoFluxo[]): Promise<Resultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Fluxo inválido." };

  const nomeParsed = z.string().trim().min(1, { error: "Informe o nome do fluxo." }).max(100).safeParse(nomeAtual.nome);
  if (!nomeParsed.success) return { error: nomeParsed.error.issues[0]?.message ?? "Nome inválido." };

  const nosParsed = z.array(noSchema).max(200).safeParse(nos);
  if (!nosParsed.success) return { error: "Estrutura do fluxo inválida." };

  const validados = parseNos(nosParsed.data);
  if (!validados.some((n) => n.tipo === "gatilho")) return { error: "O fluxo precisa ter um nó de gatilho." };
  if (validados.filter((n) => n.tipo === "gatilho").length > 1) return { error: "O fluxo só pode ter um nó de gatilho." };

  // Mensagens de até 1000 caracteres (mesmo teto dos templates de WhatsApp).
  for (const no of validados) {
    if (no.tipo === "mensagem" && (no.dados.texto?.length ?? 0) > 1000) {
      return { error: `A mensagem do nó "${no.id}" passa de 1000 caracteres.` };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_fluxos")
    .update({ nome: nomeParsed.data, descricao: nomeAtual.descricao.trim() || null, nos: validados })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o fluxo. Tente novamente." };

  revalidarFluxo(id);
  revalidarLista();
  return { success: true };
}

// ===== Testar fluxo =====

const testeSchema = z.object({ telefone: z.string().trim().min(1, { error: "Informe o telefone com DDD." }) });

export async function testarFluxo(id: string, telefone: string): Promise<Resultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Fluxo inválido." };

  const parsed = testeSchema.safeParse({ telefone });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!normalizarTelefone(parsed.data.telefone)) return { error: "Telefone inválido: informe DDD + número (ex.: 11999999999)." };

  // Variáveis de exemplo — o teste usa os placeholders literais quando não há valor (mesmo
  // comportamento do envio real: variável sem valor fica visível, não some).
  const resultado = await executarFluxo(id, parsed.data.telefone, {
    telefone: parsed.data.telefone,
    nome: "Teste",
    curso: "Curso de teste",
    valor: "R$ 100,00",
    vencimento: "01/01/2027",
    dias_atraso: "5",
    data: "01/01/2027",
    horario: "10:00",
    titulo_pagina: "Página de teste",
    turma: "Turma de teste",
  });
  if (!resultado) return { error: "Não foi possível iniciar o teste. Confira se o fluxo tem um nó de gatilho." };

  revalidarFluxo(id);
  return { success: true };
}

// ===== Execuções =====

export type ExecucaoView = {
  id: string;
  entidadeTipo: string | null;
  entidadeId: string | null;
  telefone: string;
  status: string;
  noAtual: string | null;
  createdAt: string;
  erroDetalhe: string | null;
};

export async function listarExecucoes(fluxoId: string, status?: string): Promise<ExecucaoView[] | { error: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(fluxoId).success) return { error: "Fluxo inválido." };

  const supabase = await createClient();
  let query = supabase
    .from("whatsapp_fluxos_execucoes")
    .select("id, entidade_tipo, entidade_id, telefone, status, no_atual, created_at, erro_detalhe")
    .eq("fluxo_id", fluxoId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return { error: "Não foi possível carregar as execuções." };

  return (data ?? []).map((e) => ({
    id: e.id,
    entidadeTipo: e.entidade_tipo,
    entidadeId: e.entidade_id,
    telefone: e.telefone,
    status: e.status,
    noAtual: e.no_atual,
    createdAt: e.created_at,
    erroDetalhe: e.erro_detalhe,
  }));
}

export async function cancelarExecucao(execucaoId: string): Promise<Resultado> {
  await requireRole("admin");
  if (!z.uuid().safeParse(execucaoId).success) return { error: "Execução inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_fluxos_execucoes")
    .update({ status: "cancelado", retomar_em: null })
    .eq("id", execucaoId)
    .eq("status", "em_andamento")
    .select("id");
  if (error) return { error: "Não foi possível cancelar a execução." };
  if (!data?.length) return { error: "Execução não encontrada ou já finalizada." };

  return { success: true };
}
