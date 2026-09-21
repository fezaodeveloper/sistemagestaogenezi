"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CAMPOS_IMAGEM,
  LIMITE_NOME_APP,
  REGEX_COR_HEX,
  TAG_PERSONALIZACAO,
  caminhoNoBucket,
  isCampoImagem,
} from "@/lib/personalizacao/campos";

type Resultado = { success: true } | { error: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Favicon, manifest e theme-color vivem no cache de 1h (tag) e a sidebar do admin / telas de login
// no layout: expira tudo pra a mudança valer na hora.
function atualizarCaches() {
  updateTag(TAG_PERSONALIZACAO);
  revalidatePath("/admin/configuracoes/personalizacao");
  revalidatePath("/", "layout");
}

// ===== Identidade (texto e cores) =====

const cor = z.string().trim().refine((v) => v === "" || REGEX_COR_HEX.test(v), { error: "Cor inválida (use o formato #rrggbb)." });

const identidadeSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: "Informe o nome da aplicação." })
    .max(LIMITE_NOME_APP, { error: `O nome pode ter no máximo ${LIMITE_NOME_APP} caracteres.` }),
  // Vazia = sem cor definida (nula no banco).
  corPrimaria: cor,
  corPwa: cor,
});

export async function salvarIdentidade(dados: { nome: string; corPrimaria: string; corPwa: string }): Promise<Resultado> {
  const user = await requireRole("admin");

  const parsed = identidadeSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      escola_nome: parsed.data.nome,
      escola_cor_primaria: parsed.data.corPrimaria || null,
      escola_cor_pwa: parsed.data.corPwa || null,
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Confira se a migration personalizacao_visual foi aplicada." };
  }

  atualizarCaches();
  return { success: true };
}

// ===== Imagens =====

// Todas as colunas de imagem (para saber se um arquivo ainda é usado por outro campo antes de
// apagá-lo do Storage). A consulta falha se alguma coluna não existir — quem chama trata como
// "não sei" e NÃO apaga nada.
const COLUNAS_IMAGEM = Object.keys(CAMPOS_IMAGEM).join(", ");

async function arquivoEmUso(bucket: string, caminho: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("configuracoes").select(COLUNAS_IMAGEM).eq("id", true).maybeSingle();
  if (error || !data) return true;
  return Object.values(data as unknown as Record<string, string | null>).some(
    (url) => caminhoNoBucket(url, bucket, SUPABASE_URL) === caminho,
  );
}

// Apaga do Storage o arquivo antigo se ninguém mais o usa (ex.: a logo copiada para a tela de
// login compartilha o mesmo arquivo). Best-effort: arquivo órfão é só lixo, nunca barra a ação.
async function removerArquivoSeOrfao(bucket: string, urlAntiga: string | null, caminhoNovo: string | null): Promise<void> {
  try {
    const caminho = caminhoNoBucket(urlAntiga, bucket, SUPABASE_URL);
    if (!caminho || caminho === caminhoNovo) return;
    if (await arquivoEmUso(bucket, caminho)) return;
    await createAdminClient().storage.from(bucket).remove([caminho]);
  } catch {
    // Ignora.
  }
}

// O upload em si acontece no navegador, direto pro Storage (mesmo padrão do logo/banners); esta
// action só valida a URL e grava a coluna. Cada campo salva sozinho, ao escolher o arquivo.
export async function salvarImagemPersonalizacao(campo: string, url: string): Promise<Resultado> {
  const user = await requireRole("admin");

  if (!isCampoImagem(campo)) return { error: "Campo inválido." };
  const def = CAMPOS_IMAGEM[campo];

  const caminho = caminhoNoBucket(url, def.bucket, SUPABASE_URL);
  if (!caminho || (def.pasta && !caminho.startsWith(def.pasta))) {
    return { error: "A imagem enviada é inválida. Tente enviar o arquivo de novo." };
  }

  const supabase = await createClient();
  const { data: atual, error: erroLeitura } = await supabase.from("configuracoes").select(campo).eq("id", true).maybeSingle();
  if (erroLeitura) return { error: "Não foi possível salvar. Confira se a migration personalizacao_visual foi aplicada." };
  const urlAntiga = (atual as unknown as Record<string, string | null> | null)?.[campo] ?? null;

  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      [campo]: url,
      // A logo principal tem também a coluna com o caminho (usada pelo formulário antigo em
      // Configurações): mantém as duas sincronizadas.
      ...(campo === "escola_logo_url" ? { escola_logo_path: caminho } : {}),
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível salvar a imagem. Tente novamente." };

  await removerArquivoSeOrfao(def.bucket, urlAntiga, caminho);

  atualizarCaches();
  if (campo === "escola_logo_url" || campo === "portal_login_imagem_fundo_url") {
    revalidatePath("/login");
    revalidatePath("/entrar");
    revalidatePath("/admin/configuracoes/portal-aluno/login");
  }
  return { success: true };
}

export async function removerImagemPersonalizacao(campo: string): Promise<Resultado> {
  const user = await requireRole("admin");

  if (!isCampoImagem(campo)) return { error: "Campo inválido." };
  const def = CAMPOS_IMAGEM[campo];

  const supabase = await createClient();
  const { data: atual } = await supabase.from("configuracoes").select(campo).eq("id", true).maybeSingle();
  const urlAntiga = (atual as unknown as Record<string, string | null> | null)?.[campo] ?? null;

  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      [campo]: null,
      ...(campo === "escola_logo_url" ? { escola_logo_path: null } : {}),
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível remover a imagem. Tente novamente." };

  await removerArquivoSeOrfao(def.bucket, urlAntiga, null);

  atualizarCaches();
  if (campo === "escola_logo_url" || campo === "portal_login_imagem_fundo_url") {
    revalidatePath("/login");
    revalidatePath("/entrar");
    revalidatePath("/admin/configuracoes/portal-aluno/login");
  }
  return { success: true };
}

// ===== Copiar para a tela de login =====
// logo da escola -> imagem da tela de login; cor primária da escola -> cor primária do login.
// A confirmação ("vai sobrescrever") é da tela; aqui só executa.

export async function copiarParaTelaDeLogin(): Promise<{ success: true; copiados: string[] } | { error: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { data: origem, error: erroOrigem } = await supabase
    .from("configuracoes")
    .select("escola_logo_url, escola_cor_primaria, portal_login_imagem_fundo_url")
    .eq("id", true)
    .maybeSingle();
  if (erroOrigem || !origem) {
    return { error: "Não foi possível ler as configurações. Confira se as migrations de personalização e do login foram aplicadas." };
  }

  const logo = (origem.escola_logo_url as string | null) ?? null;
  const corPrimaria = (origem.escola_cor_primaria as string | null) ?? null;
  if (!logo && !corPrimaria) return { error: "Defina a logo e/ou a cor primária da escola antes de copiar." };

  const copiados: string[] = [];
  const atualizacao: Record<string, string> = {};
  if (logo) {
    atualizacao.portal_login_imagem_fundo_url = logo;
    copiados.push("imagem da tela de login");
  }
  if (corPrimaria && REGEX_COR_HEX.test(corPrimaria)) {
    atualizacao.portal_login_cor_primaria = corPrimaria;
    copiados.push("cor primária do login");
  }
  if (copiados.length === 0) return { error: "A cor primária da escola é inválida. Salve-a de novo e tente outra vez." };

  const { data, error } = await supabase
    .from("configuracoes")
    .update({ ...atualizacao, updated_by: user.id })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) {
    return { error: "Não foi possível copiar. Confira se a migration portal_login_config foi aplicada." };
  }

  // A imagem de login anterior (se era um arquivo só dela) fica órfã.
  if (logo) {
    await removerArquivoSeOrfao(
      CAMPOS_IMAGEM.portal_login_imagem_fundo_url.bucket,
      (origem.portal_login_imagem_fundo_url as string | null) ?? null,
      null,
    );
  }

  atualizarCaches();
  revalidatePath("/entrar");
  revalidatePath("/admin/configuracoes/portal-aluno/login");
  return { success: true, copiados };
}
