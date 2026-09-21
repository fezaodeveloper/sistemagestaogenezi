// Comunidade do portal — tipos, limites e utilitários sem dependência de servidor (telas do
// aluno, painel admin e Server Actions compartilham isto).

export const COMUNIDADE_STATUS = ["ativo", "oculto", "removido"] as const;
export type ComunidadeStatus = (typeof COMUNIDADE_STATUS)[number];

export const COMUNIDADE_STATUS_LABEL: Record<ComunidadeStatus, string> = {
  ativo: "Ativo",
  oculto: "Oculto",
  removido: "Removido",
};

export const LIMITE_TITULO = 200;
export const LIMITE_CONTEUDO_POST = 5000;
export const LIMITE_CONTEUDO_RESPOSTA = 2000;
export const LIMITE_NOME_CATEGORIA = 60;
export const LIMITE_DESCRICAO_CATEGORIA = 300;
export const LIMITE_ICONE_CATEGORIA = 16;

export const COR_CATEGORIA_PADRAO = "#6b7280";
export const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;
export const ICONE_PADRAO = "💬";

export const TAMANHO_PREVIEW = 50;

export function isComunidadeStatus(valor: unknown): valor is ComunidadeStatus {
  return typeof valor === "string" && (COMUNIDADE_STATUS as readonly string[]).includes(valor);
}

// Primeiros `max` caracteres em uma linha só (quebras viram espaço), com reticências.
export function previewTexto(texto: string, max: number = TAMANHO_PREVIEW): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max).trimEnd()}…` : limpo;
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export type CategoriaView = {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  somenteAdmin: boolean;
  totalPosts: number;
};

// Autor exibido: alunos aparecem abreviados para os colegas ("Maria S."); o admin aparece
// como "Equipe" (`equipe`).
export type AutorView = { nome: string; iniciais: string; equipe: boolean };

export type PostResumoView = {
  id: string;
  categoriaId: string;
  categoriaNome: string;
  categoriaIcone: string;
  categoriaCor: string;
  titulo: string;
  preview: string;
  autor: AutorView;
  fixado: boolean;
  totalRespostas: number;
  totalCurtidas: number;
  createdAt: string;
  ultimaAtividadeAt: string;
};

export type RespostaView = {
  id: string;
  autor: AutorView;
  proprio: boolean;
  conteudo: string;
  totalCurtidas: number;
  curtido: boolean;
  createdAt: string;
};
