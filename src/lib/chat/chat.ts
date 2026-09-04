import { MessageCircle } from "lucide-react";
import type { createClient } from "@/lib/supabase/server";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import type { ArquivoAnexo, Conversa, MensagemChat } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConversaComContexto = Conversa & {
  alunoNome: string | null;
  naoLidas: number;
};

// Lista do admin: uma conversa por aluno (inbox compartilhada — RLS já
// garante que só admin chega aqui). naoLidas conta mensagens do PRÓPRIO
// aluno ainda sem lido_em — mensagem do admin não lida pelo aluno não
// conta como pendência do admin.
export async function getConversasAdmin(
  supabase: SupabaseServerClient,
): Promise<ConversaComContexto[]> {
  const { data } = await supabase
    .from("conversas")
    .select(
      "*, alunos!inner(profiles!alunos_id_fkey(full_name)), mensagens_chat(id, remetente_id, lido_em)",
    )
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false });

  const rows = (data ?? []) as unknown as Array<
    Conversa & {
      alunos: { profiles: { full_name: string | null } | null } | null;
      mensagens_chat: { id: string; remetente_id: string; lido_em: string | null }[];
    }
  >;

  return rows.map((row) => ({
    ...row,
    alunoNome: row.alunos?.profiles?.full_name ?? null,
    naoLidas: row.mensagens_chat.filter((m) => m.remetente_id === row.aluno_id && !m.lido_em).length,
  }));
}

export async function getConversaPorAluno(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<Conversa | null> {
  const { data } = await supabase.from("conversas").select("*").eq("aluno_id", alunoId).maybeSingle();
  return data as Conversa | null;
}

export async function getMensagens(
  supabase: SupabaseServerClient,
  conversaId: string,
): Promise<MensagemChat[]> {
  const { data } = await supabase
    .from("mensagens_chat")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });
  return (data ?? []) as MensagemChat[];
}

export type AlunoElegivelChat = { id: string; nome: string | null; email: string | null };

// Picker de "nova conversa" do admin — só alunos com matrícula ativa em
// curso presencial/híbrido (mesmo critério embutido na policy de insert
// de `conversas`). Filtro em código, não via encadeamento de filtro
// PostgREST em 2 níveis de embed (turmas -> cursos), que não é confiável.
export async function getAlunosElegiveisParaChat(
  supabase: SupabaseServerClient,
): Promise<AlunoElegivelChat[]> {
  const { data } = await supabase
    .from("matriculas")
    .select(
      "aluno_id, alunos!inner(email, profiles!alunos_id_fkey(full_name)), turmas!inner(cursos!inner(tipo))",
    )
    .eq("status", "ativa");

  const rows = (data ?? []) as unknown as Array<{
    aluno_id: string;
    alunos: { email: string; profiles: { full_name: string | null } | null } | null;
    turmas: { cursos: { tipo: string } | null } | null;
  }>;

  const porAluno = new Map<string, AlunoElegivelChat>();
  for (const row of rows) {
    if (row.turmas?.cursos?.tipo === "ead") continue;
    if (!porAluno.has(row.aluno_id)) {
      porAluno.set(row.aluno_id, {
        id: row.aluno_id,
        nome: row.alunos?.profiles?.full_name ?? null,
        email: row.alunos?.email ?? null,
      });
    }
  }
  return [...porAluno.values()].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
}

// RLS da policy de insert de `conversas` já reforça a elegibilidade
// (matrícula ativa em curso não-EAD) — aqui só propaga o erro em
// português caso a checagem do banco rejeite.
export async function criarConversa(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("conversas")
    .insert({ aluno_id: alunoId })
    .select("id")
    .single();

  if (error) {
    return { error: "Não foi possível iniciar a conversa — verifique se o aluno tem matrícula ativa em curso presencial ou híbrido." };
  }
  return { id: data.id };
}

export async function enviarMensagem(
  supabase: SupabaseServerClient,
  conversaId: string,
  remetenteId: string,
  texto: string,
  arquivo?: ArquivoAnexo,
): Promise<{ error?: string }> {
  const { error } = await supabase.from("mensagens_chat").insert({
    conversa_id: conversaId,
    remetente_id: remetenteId,
    texto,
    arquivo_url: arquivo?.url ?? null,
    arquivo_nome: arquivo?.nome ?? null,
    arquivo_tipo: arquivo?.tipo ?? null,
  });

  if (error) {
    return { error: "Não foi possível enviar a mensagem. Tente novamente." };
  }
  return {};
}

// Editar/excluir (TAREFA 2E) sempre restrito à própria mensagem — o
// `.eq("remetente_id", remetenteId)` é reforço aqui (a fronteira de
// verdade é a policy de RLS que só existe depois que a migration
// 20260903300000_chat_arquivos.sql for aplicada).
export async function editarMensagem(
  supabase: SupabaseServerClient,
  mensagemId: string,
  remetenteId: string,
  novoTexto: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("mensagens_chat")
    .update({ texto: novoTexto })
    .eq("id", mensagemId)
    .eq("remetente_id", remetenteId);

  if (error) {
    return { error: "Não foi possível editar a mensagem." };
  }
  return {};
}

export async function excluirMensagem(
  supabase: SupabaseServerClient,
  mensagemId: string,
  remetenteId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("mensagens_chat")
    .delete()
    .eq("id", mensagemId)
    .eq("remetente_id", remetenteId);

  if (error) {
    return { error: "Não foi possível excluir a mensagem." };
  }
  return {};
}

export async function marcarComoLidas(
  supabase: SupabaseServerClient,
  conversaId: string,
): Promise<void> {
  await supabase.rpc("marcar_mensagens_lidas", { p_conversa_id: conversaId });
}

// Usada tanto pelo balão do dashboard quanto pelo badge ao vivo da
// sidebar do admin — número de conversas (não de mensagens) com pelo
// menos uma mensagem do aluno ainda não lida.
export async function getContagemConversasNaoLidasAdmin(
  supabase: SupabaseServerClient,
): Promise<number> {
  const conversas = await getConversasAdmin(supabase);
  return conversas.filter((c) => c.naoLidas > 0).length;
}

export async function getNotificacaoConversasNaoLidas(
  supabase: SupabaseServerClient,
): Promise<DashboardNotificacao | null> {
  const quantidade = await getContagemConversasNaoLidasAdmin(supabase);

  if (!quantidade) return null;

  return {
    chave: "conversas-nao-lidas",
    titulo: "Conversas com mensagens não lidas",
    quantidade,
    href: "/admin/chat",
    icone: MessageCircle,
  };
}

export async function getContagemNaoLidasAluno(
  supabase: SupabaseServerClient,
  conversaId: string,
  alunoId: string,
): Promise<number> {
  const { count } = await supabase
    .from("mensagens_chat")
    .select("*", { count: "exact", head: true })
    .eq("conversa_id", conversaId)
    .neq("remetente_id", alunoId)
    .is("lido_em", null);
  return count ?? 0;
}
