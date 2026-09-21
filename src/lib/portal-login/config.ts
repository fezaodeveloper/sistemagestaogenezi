import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";
import type { createClient } from "@/lib/supabase/server";
import {
  PORTAL_LOGIN_PADRAO,
  REGEX_COR_HEX,
  isPortalLoginTemplate,
  isPortalLoginTipoSenha,
  type PortalLoginConfig,
  type PortalLoginTipoSenha,
} from "@/lib/portal-login/tipos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type Linha = {
  escola_nome?: string | null;
  portal_login_template?: string | null;
  portal_login_titulo?: string | null;
  portal_login_subtitulo?: string | null;
  portal_login_cor_primaria?: string | null;
  portal_login_cor_fundo?: string | null;
  portal_login_imagem_fundo_url?: string | null;
  portal_login_tipo_senha?: string | null;
  portal_login_mostrar_instalar_app?: boolean | null;
};

export const COLUNAS_PORTAL_LOGIN =
  "escola_nome, portal_login_template, portal_login_titulo, portal_login_subtitulo, portal_login_cor_primaria, portal_login_cor_fundo, portal_login_imagem_fundo_url, portal_login_tipo_senha, portal_login_mostrar_instalar_app";

// Converte a linha do banco na config (valor inválido ou ausente cai no padrão).
export function paraPortalLoginConfig(linha: Linha): PortalLoginConfig {
  const p = PORTAL_LOGIN_PADRAO;
  return {
    template: isPortalLoginTemplate(linha.portal_login_template) ? linha.portal_login_template : p.template,
    titulo: linha.portal_login_titulo?.trim() || p.titulo,
    subtitulo: linha.portal_login_subtitulo ?? p.subtitulo,
    corPrimaria: linha.portal_login_cor_primaria && REGEX_COR_HEX.test(linha.portal_login_cor_primaria) ? linha.portal_login_cor_primaria : p.corPrimaria,
    corFundo: linha.portal_login_cor_fundo && REGEX_COR_HEX.test(linha.portal_login_cor_fundo) ? linha.portal_login_cor_fundo : p.corFundo,
    imagemFundoUrl: linha.portal_login_imagem_fundo_url?.trim() || null,
    tipoSenha: isPortalLoginTipoSenha(linha.portal_login_tipo_senha) ? linha.portal_login_tipo_senha : p.tipoSenha,
    mostrarInstalarApp: linha.portal_login_mostrar_instalar_app ?? p.mostrarInstalarApp,
  };
}

// Lê a config da tela de login. Roda como `anon` (visitante sem sessão): por isso só
// pede as colunas que a migration libera pra anon. `null` = colunas ainda não existem
// (migration pendente) — quem chama mantém a tela antiga em vez de quebrar.
export async function getPortalLoginConfig(
  supabase: SupabaseServerClient,
): Promise<{ config: PortalLoginConfig; nomeEscola: string } | null> {
  const { data, error } = await supabase.from("configuracoes").select(COLUNAS_PORTAL_LOGIN).maybeSingle();
  if (error || !data) return null;
  const linha = data as unknown as Linha;
  return { config: paraPortalLoginConfig(linha), nomeEscola: linha.escola_nome?.trim() || "GÊNEZI Educação" };
}

// ===== Senha no cadastro do aluno (Server Action createAluno) =====

export type ConfigSenhaPortal = {
  tipo: PortalLoginTipoSenha;
  // Senha padrão já descriptografada; null = não definida (ou ilegível).
  senhaPadrao: string | null;
};

// Client ADMIN: a coluna da senha padrão não é legível pra anon/aluno em claro (é
// criptografada) e o cadastro do aluno roda no servidor. Nunca lança: qualquer falha
// = comportamento de sempre (senha gerada pelo admin no formulário).
export async function lerConfigSenhaPortal(): Promise<ConfigSenhaPortal> {
  try {
    const { data, error } = await createAdminClient()
      .from("configuracoes")
      .select("portal_login_tipo_senha, portal_login_senha_padrao")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return { tipo: "padrao", senhaPadrao: null };

    let senhaPadrao: string | null = null;
    const bruta = data.portal_login_senha_padrao as string | null;
    if (bruta) {
      try {
        senhaPadrao = descriptografar(bruta) || null;
      } catch {
        senhaPadrao = null;
      }
    }
    return {
      tipo: isPortalLoginTipoSenha(data.portal_login_tipo_senha) ? data.portal_login_tipo_senha : "padrao",
      senhaPadrao,
    };
  } catch {
    return { tipo: "padrao", senhaPadrao: null };
  }
}
