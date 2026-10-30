// TAREFA email 2.3 (PARTE 3) — tipos dos blocos do editor visual + geração do HTML de e-mail
// (tabela, estilo inline — compatível com clientes de e-mail) + parse de volta pra blocos.
// Sem dependência de servidor: usado tanto no client (editor) quanto, se precisar, no server.

export const ALINHAMENTOS = ["left", "center", "right"] as const;
export type Alinhamento = (typeof ALINHAMENTOS)[number];
export const ALINHAMENTO_LABELS: Record<Alinhamento, string> = { left: "Esquerda", center: "Centro", right: "Direita" };

export const TAMANHOS_TITULO = ["h1", "h2", "h3"] as const;
export type TamanhoTitulo = (typeof TAMANHOS_TITULO)[number];
export const TAMANHO_TITULO_LABELS: Record<TamanhoTitulo, string> = { h1: "Grande", h2: "Médio", h3: "Pequeno" };
const TAMANHO_TITULO_PX: Record<TamanhoTitulo, string> = { h1: "28px", h2: "22px", h3: "18px" };

export const LARGURAS_IMAGEM = ["auto", "100%", "50%"] as const;
export type LarguraImagem = (typeof LARGURAS_IMAGEM)[number];
export const LARGURA_IMAGEM_LABELS: Record<LarguraImagem, string> = { auto: "Automática", "100%": "100%", "50%": "50%" };

export const ESPACOS = [16, 32, 48] as const;
export type AlturaEspaco = (typeof ESPACOS)[number];
export const ESPACO_LABELS: Record<AlturaEspaco, string> = { 16: "Pequeno", 32: "Médio", 48: "Grande" };

export const CORES_BOTAO_PREDEFINIDAS = ["#06b6d4", "#0f172a", "#22c55e", "#ef4444", "#a855f7", "#f59e0b"] as const;

export type BlocoTitulo = { id: string; tipo: "titulo"; texto: string; tamanho: TamanhoTitulo; alinhamento: Alinhamento };
export type BlocoTexto = { id: string; tipo: "texto"; texto: string; alinhamento: Alinhamento };
export type BlocoImagem = { id: string; tipo: "imagem"; url: string; largura: LarguraImagem; alinhamento: Alinhamento };
export type BlocoBotao = { id: string; tipo: "botao"; texto: string; url: string; cor: string };
export type BlocoDivisor = { id: string; tipo: "divisor" };
export type BlocoEspaco = { id: string; tipo: "espaco"; altura: AlturaEspaco };
export type BlocoEmail = BlocoTitulo | BlocoTexto | BlocoImagem | BlocoBotao | BlocoDivisor | BlocoEspaco;

export const TIPOS_BLOCO = ["titulo", "texto", "imagem", "botao", "divisor", "espaco"] as const;
export type TipoBloco = (typeof TIPOS_BLOCO)[number];
export const TIPO_BLOCO_LABELS: Record<TipoBloco, string> = {
  titulo: "Título",
  texto: "Texto",
  imagem: "Imagem",
  botao: "Botão",
  divisor: "Divisor",
  espaco: "Espaço",
};

function gerarId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function novoBloco(tipo: TipoBloco): BlocoEmail {
  const id = gerarId();
  switch (tipo) {
    case "titulo":
      return { id, tipo, texto: "Título", tamanho: "h2", alinhamento: "left" };
    case "texto":
      return { id, tipo, texto: "Escreva aqui a sua mensagem.", alinhamento: "left" };
    case "imagem":
      return { id, tipo, url: "", largura: "100%", alinhamento: "center" };
    case "botao":
      return { id, tipo, texto: "Saiba mais", url: "https://escola.genezi.com.br", cor: CORES_BOTAO_PREDEFINIDAS[0] };
    case "divisor":
      return { id, tipo };
    case "espaco":
      return { id, tipo, altura: 32 };
  }
}

// Escapa texto pra entrar em HTML (os textos dos blocos são sempre do admin, mas o HTML final é
// enviado pra terceiros — mesmo cuidado de XSS/injeção já usado no resto do projeto).
function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function linhaBloco(conteudo: string): string {
  return `<tr><td style="padding:0;">${conteudo}</td></tr>`;
}

function renderizarBloco(bloco: BlocoEmail): string {
  switch (bloco.tipo) {
    case "titulo":
      return linhaBloco(
        `<div style="padding:16px 32px 0 32px;text-align:${bloco.alinhamento};"><span style="font-family:Arial,sans-serif;font-size:${TAMANHO_TITULO_PX[bloco.tamanho]};font-weight:bold;color:#333333;">${escaparHtml(bloco.texto)}</span></div>`,
      );
    case "texto":
      return linhaBloco(
        `<div style="padding:16px 32px;text-align:${bloco.alinhamento};"><span style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333333;white-space:pre-wrap;">${escaparHtml(bloco.texto)}</span></div>`,
      );
    case "imagem":
      if (!bloco.url.trim()) return "";
      return linhaBloco(
        `<div style="padding:16px 32px;text-align:${bloco.alinhamento};"><img src="${escaparHtml(bloco.url)}" alt="" style="max-width:100%;width:${bloco.largura === "auto" ? "auto" : bloco.largura};border:0;" /></div>`,
      );
    case "botao":
      return linhaBloco(
        `<div style="padding:16px 32px;text-align:center;"><a href="${escaparHtml(bloco.url)}" style="display:inline-block;background:${bloco.cor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:15px;">${escaparHtml(bloco.texto)}</a></div>`,
      );
    case "divisor":
      return linhaBloco(`<div style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></div>`);
    case "espaco":
      return linhaBloco(`<div style="height:${bloco.altura}px;line-height:${bloco.altura}px;">&nbsp;</div>`);
  }
}

// Marcador embutido como comentário HTML — único jeito confiável de "ler de volta" os blocos
// exatos (parse de HTML arbitrário é frágil). Se o admin editar o HTML manualmente, o marcador
// ainda existe (aponta pros blocos ANTES da edição manual) — por isso o aviso de confirmação ao
// trocar de HTML pra Visual compara o HTML atual com o que os blocos do marcador gerariam: se
// bater, foi só o editor visual que gravou; se não bater, alguém editou o HTML na mão.
const MARCADOR_INICIO = "<!--BLOCOS:";
const MARCADOR_FIM = "-->";

export function gerarHtmlDeBlocos(blocos: BlocoEmail[]): string {
  const linhas = blocos.map(renderizarBloco).filter(Boolean).join("\n");
  const marcador = `${MARCADOR_INICIO}${encodeURIComponent(JSON.stringify(blocos))}${MARCADOR_FIM}`;
  return `${marcador}
<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
    ${linhas}
  </table>
</div>`;
}

// Devolve os blocos embutidos no marcador, OU null se o HTML não foi gerado pelo editor visual
// (marcador ausente) — usado pra decidir se mostra o aviso "editado manualmente".
export function extrairBlocosDoHtml(html: string): BlocoEmail[] | null {
  const inicio = html.indexOf(MARCADOR_INICIO);
  if (inicio === -1) return null;
  const fim = html.indexOf(MARCADOR_FIM, inicio);
  if (fim === -1) return null;
  try {
    const json = decodeURIComponent(html.slice(inicio + MARCADOR_INICIO.length, fim));
    const blocos = JSON.parse(json);
    return Array.isArray(blocos) ? (blocos as BlocoEmail[]) : null;
  } catch {
    return null;
  }
}

// true = o HTML atual é exatamente o que o editor visual geraria a partir do marcador (ninguém
// editou na mão desde a última vez que o editor visual salvou).
export function htmlVeioDoEditorVisual(html: string): boolean {
  const blocos = extrairBlocosDoHtml(html);
  if (!blocos) return false;
  return gerarHtmlDeBlocos(blocos) === html;
}

// ===== Templates prontos (TAREFA) =====

export type TemplateEmailId = "em_branco" | "divulgacao_curso" | "novidades" | "lembrete_matricula";

export const TEMPLATES_EMAIL: Record<TemplateEmailId, { nome: string; blocos: () => BlocoEmail[] }> = {
  em_branco: { nome: "Em branco", blocos: () => [] },
  divulgacao_curso: {
    nome: "Divulgação de curso",
    blocos: () => [
      { id: gerarId(), tipo: "titulo", texto: "Matrículas abertas!", tamanho: "h1", alinhamento: "center" },
      { id: gerarId(), tipo: "texto", texto: "Conheça nosso novo curso e garanta sua vaga.", alinhamento: "center" },
      { id: gerarId(), tipo: "botao", texto: "Quero saber mais", url: "https://escola.genezi.com.br", cor: CORES_BOTAO_PREDEFINIDAS[0] },
    ],
  },
  novidades: {
    nome: "Novidades",
    blocos: () => [
      { id: gerarId(), tipo: "titulo", texto: "Novidades da semana", tamanho: "h2", alinhamento: "left" },
      { id: gerarId(), tipo: "texto", texto: "Escreva aqui as novidades.", alinhamento: "left" },
      { id: gerarId(), tipo: "divisor" },
      { id: gerarId(), tipo: "texto", texto: "Mais um parágrafo, se precisar.", alinhamento: "left" },
      { id: gerarId(), tipo: "botao", texto: "Ver mais", url: "https://escola.genezi.com.br", cor: CORES_BOTAO_PREDEFINIDAS[0] },
    ],
  },
  lembrete_matricula: {
    nome: "Lembrete de matrícula",
    blocos: () => [
      { id: gerarId(), tipo: "titulo", texto: "Última chance de garantir sua vaga!", tamanho: "h1", alinhamento: "center" },
      { id: gerarId(), tipo: "texto", texto: "As matrículas encerram em breve. Não perca essa oportunidade.", alinhamento: "center" },
      { id: gerarId(), tipo: "botao", texto: "Matricular agora", url: "https://escola.genezi.com.br", cor: "#ef4444" },
    ],
  },
};
