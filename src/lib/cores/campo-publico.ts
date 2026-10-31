// TAREFA fix: visibilidade dos campos de formulário nas páginas públicas (campanha, agendamento).
//
// Essas páginas deixam o admin escolher QUALQUER cor_fundo (config_visual.cor_fundo em
// agendamento_paginas, cor_fundo em campanha_paginas) — mas os campos usam os componentes
// shadcn Input/Textarea, cujas classes padrão (border-input, bg-transparent) vêm de tokens de
// tema fixos, pensados pro app logado (claro/escuro do SISTEMA), não pra uma cor arbitrária
// escolhida página a página. Resultado reportado: fundo escuro (#1e2a3a) + borda/fundo do campo
// quase idênticos ao fundo da página = campo invisível.
//
// ehFundoClaro decide pela luminância relativa (mesma fórmula de corTextoSobre em
// src/lib/portal-login/tipos.ts, duplicada aqui de propósito — mesmo padrão já usado neste
// projeto pra pequenos helpers de cor por domínio, ex.: hexParaRgba em campanha-publica-view.tsx)
// — depende só da cor escolhida pelo admin, nunca do tema claro/escuro do sistema do visitante.
const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;

export function ehFundoClaro(hex: string): boolean {
  if (!REGEX_COR_HEX.test(hex)) return true;
  const canal = (inicio: number) => {
    const c = parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminancia = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  return luminancia > 0.4;
}

// Classes Tailwind pra Input/Textarea (shadcn) — duas variantes FIXAS (nunca geradas a partir do
// hex exato, só a decisão claro/escuro muda). focus-visible usa --cor-primaria, variável CSS já
// definida no wrapper de cada página pública (ver "--cor-primaria" em campanha-publica-view.tsx e
// agendamento-publico-view.tsx) — funciona como valor arbitrário do Tailwind, sem precisar de JS.
const CAMPO_PUBLICO_FOCO =
  "outline-none transition-colors focus-visible:border-[var(--cor-primaria)] focus-visible:ring-2 focus-visible:ring-[var(--cor-primaria)]";

export const CAMPO_PUBLICO_CLARO = `h-auto rounded-lg border-2 border-gray-400 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 ${CAMPO_PUBLICO_FOCO}`;
export const CAMPO_PUBLICO_ESCURO = `h-auto rounded-lg border-2 border-white/60 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 ${CAMPO_PUBLICO_FOCO}`;

export function classesCampoPublico(corFundoPagina: string): string {
  return ehFundoClaro(corFundoPagina) ? CAMPO_PUBLICO_CLARO : CAMPO_PUBLICO_ESCURO;
}

// Variante adaptativa (usa o modificador `dark:` do Tailwind, que segue a classe `.dark` já
// aplicada pelo wrapper de tema da página — ver AgendarTema em
// src/components/agendamentos/agendar-tema.tsx) — pra campos que não sentam sobre uma cor_fundo
// arbitrária escolhida pelo admin (ex.: o Card padrão shadcn de agendamento-publico-view.tsx e
// meu-agendamento-view.tsx, que usa o tema claro/escuro do próprio app, não uma cor por página).
// Sem isso, o fix de classesCampoPublico/estiloCampoPublicoHex (JS, decide a partir de um hex)
// não daria pra aplicar aqui — não há cor_fundo de página pra essas Cards, só o tema do app.
export const CAMPO_PUBLICO_ADAPTATIVO = `h-auto rounded-lg border-2 border-gray-400 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 dark:border-white/60 dark:bg-white/10 dark:text-white dark:placeholder:text-white/50 ${CAMPO_PUBLICO_FOCO}`;

// Mesmas duas variantes em hex/rgba sólido — pra elementos que só aceitam cor via `style` (ex.:
// <select> nativo, que não pode ser estilizado por completo via classe Tailwind entre
// navegadores).
export type EstiloCampoPublicoHex = { fundo: string; borda: string; texto: string };

const ESTILO_CAMPO_CLARO: EstiloCampoPublicoHex = { fundo: "#ffffff", borda: "#9ca3af", texto: "#111827" };
const ESTILO_CAMPO_ESCURO: EstiloCampoPublicoHex = { fundo: "rgba(255,255,255,0.12)", borda: "rgba(255,255,255,0.6)", texto: "#ffffff" };

export function estiloCampoPublicoHex(corFundoPagina: string): EstiloCampoPublicoHex {
  return ehFundoClaro(corFundoPagina) ? ESTILO_CAMPO_CLARO : ESTILO_CAMPO_ESCURO;
}
