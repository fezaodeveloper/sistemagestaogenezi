import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { CampanhaPagina, CampanhaResposta } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export type CampanhaPaginaComContagem = CampanhaPagina & { totalRespostas: number };

export async function getCampanhaPaginas(
  supabase: SupabaseServerClient,
  filtros: { query?: string; status?: string; offset: number; limite: number },
): Promise<{ itens: CampanhaPaginaComContagem[]; total: number }> {
  let query = supabase
    .from("campanha_paginas")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filtros.query?.trim()) query = query.ilike("titulo", `%${filtros.query.trim()}%`);
  if (filtros.status) query = query.eq("status", filtros.status);

  query = query.range(filtros.offset, filtros.offset + filtros.limite - 1);

  const { data, count } = await query;
  const paginas = (data as CampanhaPagina[] | null) ?? [];

  const comContagem = await Promise.all(
    paginas.map(async (pagina) => {
      const { count: totalRespostas } = await supabase
        .from("campanha_respostas")
        .select("id", { count: "exact", head: true })
        .eq("pagina_id", pagina.id);
      return { ...pagina, totalRespostas: totalRespostas ?? 0 };
    }),
  );

  return { itens: comContagem, total: count ?? 0 };
}

export async function getCampanhaPagina(supabase: SupabaseServerClient, id: string): Promise<CampanhaPagina | null> {
  const { data } = await supabase.from("campanha_paginas").select("*").eq("id", id).maybeSingle();
  return data as CampanhaPagina | null;
}

// Lida pelo Server Component público (/campanha/[slug]) e pela Server Action
// de envio (enviarRespostaCampanha) — usa o client admin (service_role), não
// o client autenticado normal: um visitante com cookie de sessão
// expirado/inválido de outro login (admin/aluno/empresa no mesmo navegador)
// fazia o client normal tentar validar esse JWT e falhar ("JWT... failed
// verification"), mesmo essa rota sendo pública. service_role nunca depende
// de cookie nenhum, então esse problema não existe aqui — o filtro
// `.eq("status", "ativa")` abaixo já garante que só página ativa é
// retornada, então bypassar a RLS não abre nada que a policy não abriria de
// qualquer forma.
//
// Devolve páginas "ativa" E "encerrada": a encerrada continua visível (com o
// banner "Inscrições encerradas!" e o formulário bloqueado) em vez de virar
// 404 — quem tem o link de uma campanha que acabou vê o aviso, não uma página
// de erro. "inativa" continua sendo 404. Quem envia resposta precisa checar
// status === "encerrada" (ver enviarRespostaCampanha).
export async function getCampanhaPaginaPublica(
  admin: SupabaseAdminClient,
  slug: string,
): Promise<CampanhaPagina | null> {
  const { data } = await admin
    .from("campanha_paginas")
    .select("*")
    .eq("slug", slug)
    .in("status", ["ativa", "encerrada"])
    .maybeSingle();
  return data as CampanhaPagina | null;
}

export async function getCampanhaRespostas(
  supabase: SupabaseServerClient,
  paginaId: string,
  filtros: { data?: string; offset: number; limite: number },
): Promise<{ itens: CampanhaResposta[]; total: number }> {
  let query = supabase
    .from("campanha_respostas")
    .select("*", { count: "exact" })
    .eq("pagina_id", paginaId)
    .order("created_at", { ascending: false });

  if (filtros.data) {
    query = query.gte("created_at", `${filtros.data}T00:00:00`).lte("created_at", `${filtros.data}T23:59:59`);
  }

  query = query.range(filtros.offset, filtros.offset + filtros.limite - 1);

  const { data, count } = await query;
  return { itens: (data as CampanhaResposta[] | null) ?? [], total: count ?? 0 };
}

// Contagem pra checar vagas_limite — roda com o client admin (service_role)
// porque `anon` não tem select em `campanha_respostas` (só insert, ver
// migration). Mesma lógica de contarVagasOcupadasNoSlot em agendamentos.ts.
export async function contarRespostasAdmin(admin: SupabaseAdminClient, paginaId: string): Promise<number> {
  const { count } = await admin
    .from("campanha_respostas")
    .select("id", { count: "exact", head: true })
    .eq("pagina_id", paginaId);
  return count ?? 0;
}
