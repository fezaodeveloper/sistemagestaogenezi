export const TERMO_LEGAL_CHAVES = ["privacidade", "termos", "lgpd", "imagem"] as const;
export type TermoLegalChave = (typeof TERMO_LEGAL_CHAVES)[number];

export type TermoLegal = {
  id: string;
  chave: TermoLegalChave;
  titulo: string;
  conteudo: string;
  atualizado_em: string;
  atualizado_por: string | null;
};
