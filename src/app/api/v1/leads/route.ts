import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";
import { parsePaginacao } from "@/lib/api/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadRow = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  created_at: string;
  updated_at: string;
  cursos: { nome: string } | null;
};

export async function GET(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);
  if (!auth.permissoes.includes("leads")) {
    return respostaErro("Esta API Key não tem permissão para o recurso 'leads'.", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const { limit, offset } = parsePaginacao(url);

  const admin = createAdminClient();
  let query = admin
    .from("leads")
    .select("id, nome, telefone, status, created_at, updated_at, cursos(nome)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return respostaErro("Não foi possível consultar os leads.", 500);

  // A tabela leads não tem coluna de e-mail (só nome + telefone) — o campo
  // "email" do formato pedido vem sempre null.
  const leads = ((data ?? []) as unknown as LeadRow[]).map((lead) => ({
    id: lead.id,
    nome: lead.nome,
    email: null,
    telefone: lead.telefone,
    curso_interesse: lead.cursos?.nome ?? null,
    status: lead.status,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
  }));

  return Response.json({ data: leads, total: count ?? leads.length, limit, offset });
}
