import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { htmlParaTexto, renderizarTexto, type Variaveis } from "@/lib/email/renderizar";
import { getTemplatePadrao, type EmailTemplateId } from "@/lib/email/templates-padrao";

// Renderização dos templates de e-mail: busca o template em email_templates (editável
// pelo admin), troca os placeholders e devolve assunto + HTML prontos pra
// enviarEmail. Se a tabela estiver indisponível (migration pendente) ou sem a linha,
// cai no texto padrão do código — o e-mail nunca deixa de sair por isso.

export type TemplateRenderizado = { assunto: string; html: string; texto: string };

type LinhaTemplate = { assunto: string; corpo_html: string; variaveis: string[] | null; ativo: boolean };

let cacheNomeEscola: { valor: string; expiraEm: number } | null = null;

async function nomeDaEscola(): Promise<string> {
  if (cacheNomeEscola && cacheNomeEscola.expiraEm > Date.now()) return cacheNomeEscola.valor;
  let nome = "GÊNEZI Educação";
  try {
    const { data } = await createAdminClient().from("configuracoes").select("escola_nome").eq("id", true).maybeSingle();
    if (data?.escola_nome) nome = data.escola_nome as string;
  } catch {
    // mantém o padrão
  }
  cacheNomeEscola = { valor: nome, expiraEm: Date.now() + 60_000 };
  return nome;
}

// `null` = o admin DESATIVOU este e-mail (quem chama simplesmente não envia).
// {nome_escola} entra sozinho em qualquer template, sem quem chama informar.
export async function renderizarTemplate(id: EmailTemplateId, variaveis: Variaveis): Promise<TemplateRenderizado | null> {
  const padrao = getTemplatePadrao(id);
  let assunto = padrao.assunto;
  let corpo = padrao.corpo_html;
  let declaradas = padrao.variaveis;

  try {
    const { data, error } = await createAdminClient()
      .from("email_templates")
      .select("assunto, corpo_html, variaveis, ativo")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      const linha = data as LinhaTemplate;
      if (!linha.ativo) return null;
      assunto = linha.assunto;
      corpo = linha.corpo_html;
      // As declaradas do banco valem, mas as do padrão sempre também (nada some por edição).
      declaradas = [...new Set([...(linha.variaveis ?? []), ...padrao.variaveis])];
    }
  } catch {
    // usa o padrão do código
  }

  const todas: Variaveis = { nome_escola: await nomeDaEscola(), ...variaveis };
  const html = renderizarTexto(corpo, todas, declaradas, { escapar: true });
  return {
    assunto: renderizarTexto(assunto, todas, declaradas, { escapar: false }),
    html,
    texto: htmlParaTexto(html),
  };
}
