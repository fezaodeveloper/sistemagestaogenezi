"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { API_PERMISSOES, type ApiKey, type ApiPermissao } from "@/lib/api/schema";

export async function getApiKeys(): Promise<ApiKey[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });

  return (data as ApiKey[] | null) ?? [];
}

export type CriarApiKeyResult = { chave: string } | { error: string };

// Chave em texto puro (não hash) — o admin precisa poder ver/copiar depois
// de gerada (ver REGRAS da tarefa). A UI só mostra o valor uma vez, logo
// após a criação (ApiKeysView) — depois disso o valor não aparece mais na
// tabela, mas continua salvo em claro pra permitir o botão "Testar" da
// documentação (src/components/admin/api-documentacao.tsx) usar a chave
// ativa mais recente sem pedir pro admin colar de novo.
export async function criarApiKey(nome: string, permissoes: ApiPermissao[]): Promise<CriarApiKeyResult> {
  await requireRole("admin");

  const nomeTrim = nome.trim();
  if (!nomeTrim) {
    return { error: "Informe o nome da integração." };
  }
  const permissoesValidas = permissoes.filter((p): p is ApiPermissao => API_PERMISSOES.includes(p));
  if (permissoesValidas.length === 0) {
    return { error: "Selecione ao menos uma permissão." };
  }

  const chave = crypto.randomBytes(32).toString("hex");

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    nome: nomeTrim,
    chave,
    permissoes: permissoesValidas,
  });

  if (error) {
    return { error: "Não foi possível gerar a chave. Tente novamente." };
  }

  revalidatePath("/admin/api");
  return { chave };
}

export async function revogarApiKey(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").update({ ativa: false }).eq("id", id);

  if (error) {
    return { error: "Não foi possível revogar a chave." };
  }

  revalidatePath("/admin/api");
  return {};
}

export async function excluirApiKey(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a chave." };
  }

  revalidatePath("/admin/api");
  return {};
}
