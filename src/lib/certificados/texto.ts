// Parser puro (sem dependência de servidor/DOM) — usado tanto na geração
// do PDF (pdf.ts, com métricas de fonte do pdf-lib) quanto na prévia em
// tela do formulário de template (renderizando <strong>/<u>/font-size no
// navegador).
import type { JSONContent } from "@tiptap/react";

export type TextoRun = {
  texto: string;
  negrito: boolean;
  sublinhado: boolean;
  // undefined = usa TAMANHO_FONTE_PADRAO abaixo.
  tamanhoFonte?: number;
};

// Tamanho usado quando o admin não aplica nenhum tamanho de fonte
// explícito no editor — mesmo valor pro PDF (pdf.ts) e pra prévia em
// tela (certificado-template-form.tsx), pra prévia nunca "inventar" um
// tamanho diferente do que o PDF real vai usar.
export const TAMANHO_FONTE_PADRAO = 22;

export function tamanhoDoRun(run: TextoRun): number {
  return run.tamanhoFonte ?? TAMANHO_FONTE_PADRAO;
}

export function substituirVariaveis(texto: string, variaveis: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (match, chave: string) => variaveis[chave] ?? match);
}

function extrairTamanhoFonte(marks: JSONContent["marks"]): number | undefined {
  const mark = marks?.find((m) => m.type === "textStyle");
  const fontSize = mark?.attrs?.fontSize;
  if (typeof fontSize !== "string") return undefined;
  const numero = Number.parseInt(fontSize, 10);
  return Number.isFinite(numero) ? numero : undefined;
}

// Percorre o documento do editor Tiptap (parágrafos com nós de texto e
// marks bold/underline/textStyle) e devolve a mesma estrutura plana
// TextoRun[] que o motor de desenho do PDF já consumia antes (quando
// vinha de um parser de markdown leve **negrito**/__sublinhado__) — cada
// parágrafo, exceto o primeiro, é precedido por um run "\n" que o
// dividirEmLinhas do pdf.ts já sabe interpretar como quebra de linha.
export function tiptapJsonParaRuns(
  doc: JSONContent | null | undefined,
  variaveis: Record<string, string>,
): TextoRun[] {
  const runs: TextoRun[] = [];
  const paragrafos = doc?.content ?? [];

  paragrafos.forEach((paragrafo, index) => {
    if (index > 0) {
      runs.push({ texto: "\n", negrito: false, sublinhado: false });
    }
    for (const no of paragrafo.content ?? []) {
      if (no.type !== "text" || !no.text) continue;
      const marks = no.marks ?? [];
      runs.push({
        texto: substituirVariaveis(no.text, variaveis),
        negrito: marks.some((m) => m.type === "bold"),
        sublinhado: marks.some((m) => m.type === "underline"),
        tamanhoFonte: extrairTamanhoFonte(marks),
      });
    }
  });

  return runs;
}

export const VARIAVEIS_EXEMPLO: Record<string, string> = {
  nome_aluno: "Maria da Silva",
  nome_curso: "Curso Exemplo",
  data_conclusao: "12/08/2026",
  data_inicio: "01/03/2026",
  carga_horaria: "40 horas",
  cpf: "123.456.789-00",
  cidade: "São Paulo",
  estado: "SP",
  aproveitamento: "92%",
};
