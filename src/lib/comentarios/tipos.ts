// Comentários nas aulas — tipos e utilitários sem dependência de servidor (usados pela tela
// do aluno, pelo painel de moderação e pelas Server Actions).

export const COMENTARIO_STATUS = ["pendente", "aprovado", "rejeitado"] as const;
export type ComentarioStatus = (typeof COMENTARIO_STATUS)[number];

export const COMENTARIO_STATUS_LABEL: Record<ComentarioStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export const COMENTARIO_LIMITE_TEXTO = 2000;

export function isComentarioStatus(valor: unknown): valor is ComentarioStatus {
  return typeof valor === "string" && (COMENTARIO_STATUS as readonly string[]).includes(valor);
}

// "Maria da Silva" -> "MS" (primeira e última palavra). Nome vazio -> "?".
export function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

// "Maria da Silva" -> "Maria S." — o que os COLEGAS veem: não expõe o nome completo de
// um aluno para os outros (LGPD). O próprio aluno e o admin veem o nome inteiro.
export function nomeAbreviado(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Aluno";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${(partes[partes.length - 1][0] ?? "").toUpperCase()}.`;
}

export type ComentarioAulaView = {
  id: string;
  autorNome: string;
  iniciais: string;
  // Comentário do próprio aluno logado (mostra o status e o botão "Excluir").
  proprio: boolean;
  status: ComentarioStatus;
  texto: string;
  respostaAdmin: string | null;
  respondidoAt: string | null;
  createdAt: string;
};
