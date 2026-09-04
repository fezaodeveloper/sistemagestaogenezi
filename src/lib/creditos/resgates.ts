import { Gift } from "lucide-react";
import type { createClient } from "@/lib/supabase/server";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const RESGATE_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  entregue: "Entregue",
  concluido: "Concluído",
};

export const RESGATE_TIPO_LABELS: Record<string, string> = {
  curso_bonus: "Curso bônus",
  premio_fisico: "Prêmio físico",
};

export type ResgateAluno = {
  id: string;
  tipo: "curso_bonus" | "premio_fisico";
  itemNome: string;
  custoCreditos: number;
  status: "pendente" | "entregue" | "concluido";
  criadoEm: string;
};

export type EntregaPremioTipo = "email" | "whatsapp" | "fisico" | "manual";
export type EntregaPremioStatus = "pendente" | "enviado" | "entregue" | "falhou";

export const ENTREGA_TIPO_LABELS: Record<EntregaPremioTipo, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  fisico: "Físico",
  manual: "Manual",
};

export const ENTREGA_STATUS_LABELS: Record<EntregaPremioStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  entregue: "Entregue",
  falhou: "Falhou",
};

export const ENTREGA_STATUS_BADGE_CLASS: Record<EntregaPremioStatus, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  enviado: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  entregue: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falhou: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export type EntregaPremio = {
  id: string;
  tipo_entrega: EntregaPremioTipo;
  status: EntregaPremioStatus;
  observacoes: string | null;
};

// RLS já restringe às linhas do próprio aluno — não precisa filtrar por
// aluno_id aqui (mesmo padrão de aulas_concluidas/badges_conquistados).
// item_nome é congelado no momento do resgate — não depende de join com
// cursos/premios (que pode ter sido excluído depois).
export async function getMeusResgates(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<ResgateAluno[]> {
  const { data } = await supabase
    .from("resgates")
    .select("id, tipo, item_nome, custo_creditos, status, created_at")
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    tipo: r.tipo as "curso_bonus" | "premio_fisico",
    itemNome: r.item_nome as string,
    custoCreditos: r.custo_creditos as number,
    status: r.status as "pendente" | "entregue" | "concluido",
    criadoEm: r.created_at as string,
  }));
}

export type ResgateAdmin = ResgateAluno & { alunoNome: string | null; entregas: EntregaPremio[] };

// entregas_premios ainda não existe no banco (migration
// 20260904100000_premios_entrega.sql mostrada, não aplicada) — embutida
// no select mesmo assim, seguindo o padrão já usado no projeto pra telas
// que dependem de uma migration pendente (ver TAREFA 2B do chat).
export async function getResgatesAdmin(
  supabase: SupabaseServerClient,
  filtro?: { status?: "pendente" | "entregue" | "concluido"; tipo?: "curso_bonus" | "premio_fisico" },
): Promise<ResgateAdmin[]> {
  let query = supabase
    .from("resgates")
    .select(
      "id, tipo, item_nome, custo_creditos, status, created_at, profiles!resgates_aluno_id_fkey(full_name), entregas_premios(id, tipo_entrega, status, observacoes)",
    )
    .order("created_at", { ascending: false });

  if (filtro?.status) query = query.eq("status", filtro.status);
  if (filtro?.tipo) query = query.eq("tipo", filtro.tipo);

  const { data } = await query;

  return ((data ?? []) as unknown as Array<{
    id: string;
    tipo: "curso_bonus" | "premio_fisico";
    item_nome: string;
    custo_creditos: number;
    status: "pendente" | "entregue" | "concluido";
    created_at: string;
    profiles: { full_name: string | null } | null;
    entregas_premios: EntregaPremio[] | null;
  }>).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    itemNome: r.item_nome,
    custoCreditos: r.custo_creditos,
    status: r.status,
    criadoEm: r.created_at,
    alunoNome: r.profiles?.full_name ?? null,
    entregas: r.entregas_premios ?? [],
  }));
}

// count com head:true não traz linha nenhuma, só o total — mais barato
// que buscar os resgates inteiros só pra contar. /admin/resgates já
// mostra "Pendentes de entrega" como a primeira seção da página, então
// o balão não precisa de query param de filtro, só linkar direto.
export async function getNotificacaoResgatesPendentes(
  supabase: SupabaseServerClient,
): Promise<DashboardNotificacao | null> {
  const { count } = await supabase
    .from("resgates")
    .select("*", { count: "exact", head: true })
    .eq("status", "pendente")
    .eq("tipo", "premio_fisico");

  if (!count) return null;

  return {
    chave: "resgates-pendentes",
    titulo: "Resgates pendentes de entrega",
    quantidade: count,
    href: "/admin/resgates",
    icone: Gift,
  };
}
