// Sanitização leve de HTML produzido pelo editor rico de campanha (src/components/admin/
// editor-rico.tsx) antes de renderizar com dangerouslySetInnerHTML na página pública
// (campanha-publica-view.tsx). Baseada em regex, não num parser de DOM — suficiente aqui porque
// quem escreve esse HTML já é admin autenticado (mesmo nível de confiança de outros campos
// livres do painel, como os templates de WhatsApp/email), não um visitante anônimo; o objetivo é
// blindar contra <script>/<iframe>/atributos on* copiados ou colados por acidente, não contra um
// atacante deliberado com acesso de admin (que já teria acesso mais amplo ao sistema de qualquer
// forma). Para HTML de origem não confiável, isso NÃO é suficiente — usar um parser de verdade
// (ex. DOMPurify) nesse caso.
const TAGS_PROIBIDAS = /<(script|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>|<(script|iframe)\b[^>]*\/?>/gi;
const ATRIBUTO_ON = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s"'>]+)/gi;

export function sanitizarHtml(html: string): string {
  if (!html) return "";
  return html.replace(TAGS_PROIBIDAS, "").replace(ATRIBUTO_ON, "");
}
