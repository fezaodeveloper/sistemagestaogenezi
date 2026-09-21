// Conquistas personalizadas do portal — tipos, gatilhos e utilitários sem dependência de
// servidor (tela do aluno, painel admin, modal e Server Actions compartilham isto).
//
// NÃO confundir com as MEDALHAS (badges fixos/progressivos: src/lib/gamificacao/badges*.ts,
// tabelas badges/badges_conquistados) — sistema separado, que continua funcionando.

export const CONQUISTA_GATILHOS = [
  "primeira_aula",
  "n_aulas",
  "percentual_curso",
  "curso_completo",
  "primeiro_comentario",
  "certificado_emitido",
  "n_pontos",
] as const;
export type ConquistaGatilho = (typeof CONQUISTA_GATILHOS)[number];

export const CONQUISTA_GATILHO_LABEL: Record<ConquistaGatilho, string> = {
  primeira_aula: "Primeira aula concluída",
  n_aulas: "N aulas concluídas",
  percentual_curso: "% de um curso concluído",
  curso_completo: "Curso completo",
  primeiro_comentario: "Primeiro comentário aprovado",
  certificado_emitido: "Certificado emitido",
  n_pontos: "N pontos acumulados",
};

// Gatilhos que pedem um valor, com o rótulo do campo e os limites.
export const CONQUISTA_GATILHO_VALOR: Partial<Record<ConquistaGatilho, { rotulo: string; min: number; max: number }>> = {
  n_aulas: { rotulo: "Quantidade de aulas", min: 1, max: 100000 },
  percentual_curso: { rotulo: "Percentual do curso (%)", min: 1, max: 100 },
  n_pontos: { rotulo: "Pontos necessários", min: 1, max: 10000000 },
};

export function gatilhoPedeValor(gatilho: ConquistaGatilho): boolean {
  return gatilho in CONQUISTA_GATILHO_VALOR;
}

export function isConquistaGatilho(valor: unknown): valor is ConquistaGatilho {
  return typeof valor === "string" && (CONQUISTA_GATILHOS as readonly string[]).includes(valor);
}

// Frase "como desbloquear" — mostrada ao aluno nas conquistas bloqueadas e no painel admin.
export function descreverGatilho(gatilho: ConquistaGatilho, valor: number | null): string {
  const n = valor ?? 0;
  switch (gatilho) {
    case "primeira_aula":
      return "Conclua sua primeira aula";
    case "n_aulas":
      return `Conclua ${n} ${n === 1 ? "aula" : "aulas"}`;
    case "percentual_curso":
      return `Conclua ${n}% de um curso`;
    case "curso_completo":
      return "Conclua um curso inteiro";
    case "primeiro_comentario":
      return "Tenha seu primeiro comentário aprovado";
    case "certificado_emitido":
      return "Emita um certificado";
    case "n_pontos":
      return `Acumule ${n} pontos`;
  }
}

export const LIMITE_TITULO_CONQUISTA = 60;
export const LIMITE_DESCRICAO_CONQUISTA = 300;
export const LIMITE_EMOJI_CONQUISTA = 16;
export const EMOJI_PADRAO_CONQUISTA = "🏆";

// Imagem do badge: bucket público criado pela migration (1 MB, sem SVG).
export const CONQUISTA_BUCKET = "conquistas-badges";
export const CONQUISTA_IMAGEM_MAX_BYTES = 1024 * 1024;
export const CONQUISTA_IMAGEM_TIPOS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

// Conquista como o aluno a vê (catálogo + o que ele já desbloqueou).
export type ConquistaAlunoView = {
  id: string;
  titulo: string;
  descricao: string | null;
  comoDesbloquear: string;
  badgeUrl: string | null;
  badgeEmoji: string | null;
  // ISO de quando desbloqueou; null = bloqueada.
  desbloqueadaEm: string | null;
};

// Conquista recém-desbloqueada, para o modal de celebração.
export type ConquistaNovaView = {
  // id da linha em aluno_conquistas (usado para marcar "vista").
  desbloqueioId: string;
  titulo: string;
  descricao: string | null;
  badgeUrl: string | null;
  badgeEmoji: string | null;
};

// Conquista como o admin a vê.
export type ConquistaAdminView = {
  id: string;
  titulo: string;
  descricao: string | null;
  gatilho: ConquistaGatilho;
  gatilhoValor: number | null;
  badgeUrl: string | null;
  badgeEmoji: string | null;
  ativo: boolean;
  ordem: number;
  totalDesbloqueios: number;
};
