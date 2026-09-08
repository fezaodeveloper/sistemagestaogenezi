"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type RecompensaTipo = "premio" | "curso";

export type RecompensaDoBadge = {
  id: string;
  tipo: RecompensaTipo;
  nomeItem: string;
  descricaoRecompensa: string | null;
  prazoEntregaDias: number | null;
};

export type BadgeComRecompensas = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  ordem: number;
  recompensas: RecompensaDoBadge[];
};

type MedalhaRecompensaRow = {
  id: string;
  badge_id: string;
  tipo: RecompensaTipo;
  descricao_recompensa: string | null;
  prazo_entrega_dias: number | null;
  premios: { nome: string } | null;
  cursos: { nome: string } | null;
};

export async function getBadgesComRecompensas(): Promise<BadgeComRecompensas[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data: badgesData }, { data: recompensasData }] = await Promise.all([
    supabase.from("badges").select("id, nome, descricao, icone, ordem").order("ordem"),
    supabase
      .from("medalha_recompensas")
      .select("id, badge_id, tipo, descricao_recompensa, prazo_entrega_dias, premios(nome), cursos(nome)"),
  ]);

  const recompensasPorBadge = new Map<string, RecompensaDoBadge[]>();
  for (const row of (recompensasData ?? []) as unknown as MedalhaRecompensaRow[]) {
    const lista = recompensasPorBadge.get(row.badge_id) ?? [];
    lista.push({
      id: row.id,
      tipo: row.tipo,
      nomeItem: (row.tipo === "premio" ? row.premios?.nome : row.cursos?.nome) ?? "—",
      descricaoRecompensa: row.descricao_recompensa,
      prazoEntregaDias: row.prazo_entrega_dias,
    });
    recompensasPorBadge.set(row.badge_id, lista);
  }

  return (badgesData ?? []).map((badge) => ({
    id: badge.id,
    nome: badge.nome,
    descricao: badge.descricao,
    icone: badge.icone,
    ordem: badge.ordem,
    recompensas: recompensasPorBadge.get(badge.id) ?? [],
  }));
}

export type OpcaoRecompensa = { id: string; nome: string; tipoPremio?: "fisico" | "digital" | "hibrido" };

export async function getOpcoesRecompensa(): Promise<{
  premios: OpcaoRecompensa[];
  cursos: OpcaoRecompensa[];
}> {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data: premiosData }, { data: cursosData }] = await Promise.all([
    supabase.from("premios").select("id, nome, tipo").eq("ativo", true).order("nome"),
    supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  return {
    premios: (premiosData ?? []).map((p) => ({ id: p.id, nome: p.nome, tipoPremio: p.tipo })) as OpcaoRecompensa[],
    cursos: (cursosData ?? []) as OpcaoRecompensa[],
  };
}

export type RecompensaActionResult = { success: true } | { error: string };

export async function criarRecompensa(formData: FormData): Promise<RecompensaActionResult> {
  await requireRole("admin");

  const badgeId = String(formData.get("badge_id") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");
  const premioId = String(formData.get("premio_id") ?? "").trim();
  const cursoId = String(formData.get("curso_id") ?? "").trim();
  const descricaoRecompensa = String(formData.get("descricao_recompensa") ?? "").trim();
  const prazoEntregaDiasBruto = String(formData.get("prazo_entrega_dias") ?? "").trim();

  if (!badgeId || (tipo !== "premio" && tipo !== "curso")) {
    return { error: "Dados inválidos." };
  }
  if (tipo === "premio" && !premioId) {
    return { error: "Selecione o prêmio." };
  }
  if (tipo === "curso" && !cursoId) {
    return { error: "Selecione o curso." };
  }

  let prazoEntregaDias: number | null = null;
  if (tipo === "premio" && prazoEntregaDiasBruto) {
    const numero = Number(prazoEntregaDiasBruto);
    if (!Number.isInteger(numero) || numero <= 0) {
      return { error: "O prazo de entrega precisa ser um número inteiro maior que zero." };
    }
    prazoEntregaDias = numero;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("medalha_recompensas").insert({
    badge_id: badgeId,
    tipo,
    premio_id: tipo === "premio" ? premioId : null,
    curso_id: tipo === "curso" ? cursoId : null,
    descricao_recompensa: descricaoRecompensa || null,
    prazo_entrega_dias: prazoEntregaDias,
  });

  if (error) {
    return { error: "Não foi possível salvar a recompensa. Tente novamente." };
  }

  revalidatePath("/admin/engajamento/recompensas");
  return { success: true };
}

export async function excluirRecompensa(id: string): Promise<RecompensaActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("medalha_recompensas").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a recompensa." };
  }

  revalidatePath("/admin/engajamento/recompensas");
  return { success: true };
}
