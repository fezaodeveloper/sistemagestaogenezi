"use server";

import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SETORES_CONECTA } from "@/lib/conecta/schema";
import { z } from "zod";

const perfilEmpresaFormSchema = z.object({
  nome_empresa: z
    .string({ error: "Informe o nome da empresa." })
    .trim()
    .min(1, { error: "Informe o nome da empresa." })
    .max(200),
  cnpj: z.string().trim().max(20).optional(),
  setor: z.enum(SETORES_CONECTA).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
  site: z.string().trim().max(300).optional(),
  nome_responsavel: z
    .string({ error: "Informe o nome do responsável." })
    .trim()
    .min(1, { error: "Informe o nome do responsável." })
    .max(200),
  whatsapp: z
    .string({ error: "Informe o WhatsApp." })
    .trim()
    .min(1, { error: "Informe o WhatsApp." })
    .max(30),
  telefone: z.string().trim().max(30).optional(),
  descricao: z.string().trim().max(2000).optional(),
});

export async function atualizarPerfilEmpresa(formData: FormData): Promise<{ error?: string }> {
  const user = await requireEmpresa();

  const parsed = perfilEmpresaFormSchema.safeParse({
    nome_empresa: formData.get("nome_empresa"),
    cnpj: formData.get("cnpj") || undefined,
    setor: formData.get("setor") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    site: formData.get("site") || undefined,
    nome_responsavel: formData.get("nome_responsavel"),
    whatsapp: formData.get("whatsapp"),
    telefone: formData.get("telefone") || undefined,
    descricao: formData.get("descricao") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const data = parsed.data;
  const supabase = await createClient();
  // Sem checagem manual de "esse é o profile_id certo" — a policy "Empresa
  // edita proprio perfil" (RLS) já escopa o UPDATE por profile_id = auth.uid().
  const { error } = await supabase
    .from("empresas_conecta")
    .update({
      nome_empresa: data.nome_empresa,
      cnpj: data.cnpj ?? null,
      setor: data.setor ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      site: data.site ?? null,
      nome_responsavel: data.nome_responsavel,
      whatsapp: data.whatsapp,
      telefone: data.telefone ?? null,
      descricao: data.descricao ?? null,
    })
    .eq("profile_id", user.id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/empresa/perfil");
  return {};
}

// ===== Logo da empresa =====
//
// Upload em si acontece do lado do client, direto pro Supabase Storage —
// mesmo padrão já usado pra logo da escola e foto do aluno neste projeto
// (ver foto-aluno-upload.tsx: "upsert:true é a solução, não 'remover
// antes'" — tentar remover o arquivo antigo antes de subir o novo já
// causou bug de 'resource already exists' nessas duas features). Path fixo
// por empresa (logos/{profile_id}.{ext}), upsert sobrescreve direto. Essa
// action só grava a URL/path já prontos na tabela.

export async function salvarLogoEmpresa(url: string, path: string): Promise<{ error?: string }> {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas_conecta")
    .update({ logo_url: url, logo_path: path })
    .eq("profile_id", user.id);

  if (error) {
    return { error: "Logo enviada mas não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/empresa/perfil");
  return {};
}

export async function removerLogoEmpresa(): Promise<{ error?: string }> {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const { data: empresa } = await supabase
    .from("empresas_conecta")
    .select("logo_path")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (empresa?.logo_path) {
    await supabase.storage.from("logos-conecta").remove([empresa.logo_path]);
  }

  const { error } = await supabase
    .from("empresas_conecta")
    .update({ logo_url: null, logo_path: null })
    .eq("profile_id", user.id);

  if (error) {
    return { error: "Não foi possível remover a logo. Tente novamente." };
  }

  revalidatePath("/empresa/perfil");
  return {};
}

// Mesmo padrão de trocarSenha (src/app/aluno/perfil/actions.ts): confirma a
// senha atual via signInWithPassword antes de trocar — updateUser sozinho
// não pede a senha atual, então sem essa checagem qualquer sessão já aberta
// poderia trocar a senha sem confirmar que é realmente o dono da conta.
export async function trocarSenhaEmpresa(
  senhaAtual: string,
  novaSenha: string,
): Promise<{ success?: true; error?: string }> {
  const user = await requireEmpresa();

  if (!user.email) {
    return { error: "Não foi possível identificar o e-mail desta conta." };
  }
  if (novaSenha.length < 8) {
    return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }

  const supabase = await createClient();

  const { error: senhaAtualError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senhaAtual,
  });

  if (senhaAtualError) {
    return { error: "Senha atual incorreta." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });

  if (updateError) {
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  return { success: true };
}
