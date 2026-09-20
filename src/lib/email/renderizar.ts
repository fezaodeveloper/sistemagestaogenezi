// Renderização de templates de e-mail — funções PURAS (sem servidor), usadas tanto
// no envio (src/lib/email/templates.ts) quanto no preview ao vivo da tela de edição.
//
// Sintaxe:
//   {variavel}                     -> valor (HTML escapado no corpo; puro no assunto)
//   {#se variavel} ... {/se}       -> o trecho só aparece se a variável não estiver vazia
//
// Só as variáveis DECLARADAS pelo template são substituídas (as não informadas viram
// vazio); qualquer outra "{coisa}" fica intacta, então chaves de CSS ou de texto
// comum nunca são apagadas por engano.

export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type Variaveis = Record<string, string | number | null | undefined>;

function valorDe(variaveis: Variaveis, nome: string): string {
  const v = variaveis[nome];
  return v === null || v === undefined ? "" : String(v);
}

function aplicarCondicionais(texto: string, variaveis: Variaveis): string {
  return texto.replace(/\{#se\s+(\w+)\}([\s\S]*?)\{\/se\}/g, (_todo, nome: string, interno: string) =>
    valorDe(variaveis, nome).trim() ? interno : "",
  );
}

export function renderizarTexto(
  texto: string,
  variaveis: Variaveis,
  declaradas: readonly string[],
  opcoes: { escapar: boolean },
): string {
  const permitidas = new Set(declaradas);
  return aplicarCondicionais(texto, variaveis).replace(/\{(\w+)\}/g, (todo, nome: string) => {
    if (!permitidas.has(nome)) return todo;
    const valor = valorDe(variaveis, nome);
    return opcoes.escapar ? escapeHtml(valor) : valor;
  });
}

// Versão texto simples (parte alternativa do e-mail e clientes sem HTML).
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
