import "server-only";

import { UserPlus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarTelefone } from "@/lib/mensagens/texto";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import type { createClient } from "@/lib/supabase/server";
import type { Lead, LeadFormValues } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type LeadComCurso = Lead & { nomeCurso: string | null };

export async function getLeads(supabase: SupabaseServerClient): Promise<LeadComCurso[]> {
  const { data } = await supabase
    .from("leads")
    .select("*, cursos(nome)")
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as Array<Lead & { cursos: { nome: string } | null }>).map((l) => ({
    ...l,
    nomeCurso: l.cursos?.nome ?? null,
  }));
}

export async function getLead(
  supabase: SupabaseServerClient,
  id: string,
): Promise<LeadComCurso | null> {
  const { data } = await supabase.from("leads").select("*, cursos(nome)").eq("id", id).single();
  const lead = data as unknown as (Lead & { cursos: { nome: string } | null }) | null;
  if (!lead) return null;
  return { ...lead, nomeCurso: lead.cursos?.nome ?? null };
}

export async function getNotificacaoLeadsNovos(
  supabase: SupabaseServerClient,
): Promise<DashboardNotificacao | null> {
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "novo");

  if (!count) return null;

  return {
    chave: "leads-novos",
    titulo: "Leads novos aguardando contato",
    quantidade: count,
    href: "/admin/leads",
    icone: UserPlus,
  };
}

// Único ponto de entrada de dado do formulário público (/captacao) — sem
// requireRole() de propósito, é a única Server Action do projeto
// genuinamente alcançável por um visitante sem conta. Roda com o client
// admin (service_role): não existe sessão nem RLS de "anon" pra leads
// (ver migration) — a validação de input abaixo é a única fronteira.
//
// Dedup: se já existe um lead em aberto (status novo/contatado) com o
// mesmo telefone (normalizado) + curso, atualiza esse registro em vez de
// criar duplicata (anexa a observação nova, se houver). O índice único
// parcial da migration é a rede de segurança contra a corrida rara de
// duas submissões simultâneas — nesse caso o insert falha com 23505 e a
// function trata como sucesso mesmo assim (do ponto de vista de quem
// preencheu o formulário, o interesse foi registrado de um jeito ou de
// outro).
export async function criarOuAtualizarLeadPublico(
  input: LeadFormValues,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const normalizadoNovo = normalizarTelefone(input.telefone);

  if (normalizadoNovo) {
    const { data: abertos } = await admin
      .from("leads")
      .select("id, telefone, observacoes")
      .eq("curso_id", input.curso_id)
      .in("status", ["novo", "contatado"]);

    const existente = (abertos ?? []).find((l) => normalizarTelefone(l.telefone) === normalizadoNovo);

    if (existente) {
      const observacoesFinal = input.observacoes
        ? [existente.observacoes, input.observacoes].filter(Boolean).join("\n---\n")
        : existente.observacoes;

      const { error } = await admin
        .from("leads")
        .update({ observacoes: observacoesFinal, updated_at: new Date().toISOString() })
        .eq("id", existente.id);

      if (error) {
        return { error: "Não foi possível enviar. Tente novamente." };
      }
      return {};
    }
  }

  const { error } = await admin.from("leads").insert({
    nome: input.nome,
    telefone: input.telefone,
    curso_id: input.curso_id,
    origem: input.origem,
    observacoes: input.observacoes ?? null,
  });

  if (error && error.code !== "23505") {
    return { error: "Não foi possível enviar. Tente novamente." };
  }

  return {};
}
