"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import type {
  EmpresaConecta,
  EmpresaConectaComExtras,
  EmpresasConectaFiltro,
  EmpresasConectaResultado,
} from "@/lib/conecta/schema";

const LIMITE_PADRAO = 12;

// total_vagas e ultimo_acesso não vêm de um JOIN em SQL (supabase-js não
// expressa COUNT/MAX agregados por linha nativamente, mesmo padrão já
// resolvido em JS noutras telas deste projeto, ex.: vagasPorCurso em
// aluno/page.tsx) — total_vagas é contado à parte em vagas_conecta;
// ultimo_acesso vem da Admin API do Auth (auth.users.last_sign_in_at não é
// uma coluna de profiles/empresas_conecta, não dá pra selecionar via
// PostgREST).
export async function getEmpresasConecta(
  filtro: EmpresasConectaFiltro = {},
): Promise<EmpresasConectaResultado> {
  await requireRole("admin");

  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase.from("empresas_conecta").select("*", { count: "exact" });

  const termo = filtro.query?.trim();
  if (termo) {
    query = query.or(`nome_empresa.ilike.%${termo}%,cnpj.ilike.%${termo}%`);
  }
  // Filtro de status extra além do pedido original (só query/page/limit) —
  // sem isso, paginação + abas de status (pendente/ativa/suspensa) já
  // existentes desde a Etapa 1 ficariam incoerentes (contagem de página não
  // bateria com o filtro aplicado só no client).
  if (filtro.status) {
    query = query.eq("status", filtro.status);
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const empresas = (data as EmpresaConecta[] | null) ?? [];
  const empresaIds = empresas.map((empresa) => empresa.id);

  const totalVagasPorEmpresa = new Map<string, number>();
  if (empresaIds.length > 0) {
    const { data: vagasData } = await supabase
      .from("vagas_conecta")
      .select("empresa_id")
      .in("empresa_id", empresaIds);
    for (const vaga of vagasData ?? []) {
      const atual = totalVagasPorEmpresa.get(vaga.empresa_id) ?? 0;
      totalVagasPorEmpresa.set(vaga.empresa_id, atual + 1);
    }
  }

  const admin = createAdminClient();
  const ultimoAcessoPorEmpresa = new Map<string, string | null>();
  await Promise.all(
    empresas.map(async (empresa) => {
      try {
        const { data: userData } = await admin.auth.admin.getUserById(empresa.profile_id);
        ultimoAcessoPorEmpresa.set(empresa.id, userData.user?.last_sign_in_at ?? null);
      } catch {
        ultimoAcessoPorEmpresa.set(empresa.id, null);
      }
    }),
  );

  const empresasComExtras: EmpresaConectaComExtras[] = empresas.map((empresa) => ({
    ...empresa,
    totalVagas: totalVagasPorEmpresa.get(empresa.id) ?? 0,
    ultimoAcesso: ultimoAcessoPorEmpresa.get(empresa.id) ?? null,
  }));

  return { empresas: empresasComExtras, total: count ?? 0 };
}

// UPDATE de status em empresas_conecta funciona pelo client autenticado
// normal — a tabela já tem grant de UPDATE pra authenticated e a policy
// "Admins gerenciam empresas" (FOR ALL) cobre admins (ver migration). Só
// excluirEmpresa (abaixo) realmente precisa do client admin, porque o
// grant de DELETE ali é só pra service_role.
export async function ativarEmpresa(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas_conecta")
    .update({ status: "ativa", aprovada_em: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível ativar a empresa. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}

export async function suspenderEmpresa(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("empresas_conecta").update({ status: "suspensa" }).eq("id", id);

  if (error) {
    return { error: "Não foi possível suspender a empresa. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}

// Client admin de propósito: a migration só dá grant de DELETE em
// empresas_conecta pra service_role, não pra authenticated — mesmo padrão
// já usado em deleteAluno (auth.admin.deleteUser também exige o client
// admin).
export async function excluirEmpresa(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { error } = await admin.from("empresas_conecta").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a empresa. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}

export async function enviarNotificacaoEmpresa(
  empresaId: string,
  titulo: string,
  mensagem: string,
): Promise<{ error?: string }> {
  const admin = await requireRole("admin");

  if (!titulo.trim() || !mensagem.trim()) {
    return { error: "Preencha título e mensagem." };
  }

  const supabase = await createClient();
  const { data: empresa } = await supabase
    .from("empresas_conecta")
    .select("nome_empresa")
    .eq("id", empresaId)
    .maybeSingle();

  const { error } = await supabase.from("notificacoes_empresa").insert({
    empresa_id: empresaId,
    titulo: titulo.trim(),
    mensagem: mensagem.trim(),
    created_by: admin.id,
  });

  if (error) {
    return { error: "Não foi possível enviar a notificação. Tente novamente." };
  }

  // Best-effort — a notificação já foi salva com sucesso acima, uma falha
  // aqui (Telegram) não deve reportar erro pro admin.
  try {
    await dispararEvento(
      "conecta.mensagem.enviada",
      {
        nome_empresa: empresa?.nome_empresa ?? "—",
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
      },
      `conecta-mensagem-${empresaId}-${Date.now()}`,
    );
  } catch {
    // Best-effort — ver comentário acima.
  }

  revalidatePath("/admin/conecta");
  // type "layout" invalida o cache de toda a árvore sob /empresa (não só
  // /empresa/notificacoes) — sem isso, o badge de não lidas na sidebar
  // (renderizado pelo layout) ficaria desatualizado até a empresa navegar
  // pra um path nunca visitado (Partial Rendering do Next não re-executa
  // layout entre navegações client-side de rotas irmãs, ver CLAUDE.md).
  revalidatePath("/empresa", "layout");
  return {};
}
