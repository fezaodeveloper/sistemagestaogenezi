"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import { PORTAL_LOGIN_TEMPLATES, PORTAL_LOGIN_TIPOS_SENHA, REGEX_COR_HEX } from "@/lib/portal-login/tipos";

export type DadosPortalLoginForm = {
  template: string;
  titulo: string;
  subtitulo: string;
  corPrimaria: string;
  corFundo: string;
  // Vazia = sem imagem.
  imagemFundoUrl: string;
  tipoSenha: string;
  // Só vale no tipo "padrao". Vazia = sem senha padrão.
  senhaPadrao: string;
  mostrarInstalarApp: boolean;
};

const cor = z.string().regex(REGEX_COR_HEX, { error: "Cor inválida (use o formato #rrggbb)." });

const dadosSchema = z.object({
  template: z.enum(PORTAL_LOGIN_TEMPLATES, { error: "Escolha o template." }),
  titulo: z.string().trim().min(1, { error: "Informe o título." }).max(80, { error: "O título pode ter no máximo 80 caracteres." }),
  subtitulo: z.string().trim().max(200, { error: "O subtítulo pode ter no máximo 200 caracteres." }),
  corPrimaria: cor,
  corFundo: cor,
  imagemFundoUrl: z.string().trim().max(2000),
  tipoSenha: z.enum(PORTAL_LOGIN_TIPOS_SENHA, { error: "Escolha o tipo de senha." }),
  senhaPadrao: z.string().max(72, { error: "A senha padrão pode ter no máximo 72 caracteres." }),
  mostrarInstalarApp: z.boolean(),
});

export async function salvarPortalLogin(dadosBrutos: DadosPortalLoginForm): Promise<{ success: true } | { error: string }> {
  const user = await requireRole("admin");

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  // A imagem entra em CSS (url("...")): só https, sem aspas/parênteses que escapariam dela.
  if (dados.imagemFundoUrl && !/^https:\/\/[^\s"'()\\]+$/.test(dados.imagemFundoUrl)) {
    return { error: "A URL da imagem é inválida (use um endereço https)." };
  }

  // Senha padrão só existe no tipo "padrao"; e precisa ter 8+ caracteres (mínimo do cadastro).
  const senhaPadrao = dados.tipoSenha === "padrao" ? dados.senhaPadrao.trim() : "";
  if (senhaPadrao && senhaPadrao.length < 8) return { error: "A senha padrão precisa ter pelo menos 8 caracteres." };

  // Criptografada: authenticated lê a tabela toda (todo aluno logado), então o valor
  // nunca pode ir em texto puro pro banco.
  let senhaPadraoCriptografada: string | null = null;
  if (senhaPadrao) {
    try {
      senhaPadraoCriptografada = criptografar(senhaPadrao);
    } catch (erro) {
      if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
      return { error: "Não foi possível proteger a senha padrão. Tente novamente." };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      portal_login_template: dados.template,
      portal_login_titulo: dados.titulo,
      portal_login_subtitulo: dados.subtitulo,
      portal_login_cor_primaria: dados.corPrimaria,
      portal_login_cor_fundo: dados.corFundo,
      portal_login_imagem_fundo_url: dados.imagemFundoUrl || null,
      portal_login_tipo_senha: dados.tipoSenha,
      portal_login_senha_padrao: senhaPadraoCriptografada,
      portal_login_mostrar_instalar_app: dados.mostrarInstalarApp,
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Confira se a migration portal_login_config foi aplicada." };
  }

  revalidatePath("/entrar");
  revalidatePath("/admin/configuracoes/portal-aluno/login");
  revalidatePath("/admin/alunos/novo");
  return { success: true };
}
