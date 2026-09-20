// Tipos e textos do módulo de E-mail Marketing — sem dependência de servidor (tela e
// servidor usam a mesma lista).

export const SEGMENTOS_EMAIL = [
  "todos",
  "ativos",
  "inativos",
  "curso_especifico",
  "com_cobranca_atrasada",
  "sem_matricula",
] as const;
export type SegmentoEmail = (typeof SEGMENTOS_EMAIL)[number];

export const SEGMENTO_LABELS: Record<SegmentoEmail, string> = {
  todos: "Todos os alunos",
  ativos: "Alunos com matrícula ativa",
  inativos: "Alunos sem matrícula ativa",
  curso_especifico: "Alunos de um curso específico",
  com_cobranca_atrasada: "Alunos com cobrança em atraso",
  sem_matricula: "Cadastrados sem nenhuma matrícula",
};

export const CAMPANHA_STATUSES = ["rascunho", "agendada", "enviando", "enviada", "cancelada"] as const;
export type CampanhaEmailStatus = (typeof CAMPANHA_STATUSES)[number];

export const CAMPANHA_STATUS_LABELS: Record<CampanhaEmailStatus, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  enviando: "Enviando",
  enviada: "Enviada",
  cancelada: "Cancelada",
};

export const CAMPANHA_STATUS_CLASSES: Record<CampanhaEmailStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  agendada: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  enviando: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  enviada: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  cancelada: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export function isSegmentoEmail(valor: unknown): valor is SegmentoEmail {
  return typeof valor === "string" && (SEGMENTOS_EMAIL as readonly string[]).includes(valor);
}

export function isCampanhaEmailStatus(valor: unknown): valor is CampanhaEmailStatus {
  return typeof valor === "string" && (CAMPANHA_STATUSES as readonly string[]).includes(valor);
}

// Variáveis aceitas no assunto e no corpo da campanha.
export const VARIAVEIS_CAMPANHA = ["nome_cliente", "email_cliente", "nome_escola"] as const;

export const EXEMPLO_CAMPANHA: Record<string, string> = {
  nome_cliente: "Maria Silva",
  email_cliente: "maria@exemplo.com",
  nome_escola: "GÊNEZI Educação",
};

// Ponto de partida de uma campanha nova.
export const CORPO_INICIAL_CAMPANHA = `<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:#0f172a;color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:#1e293b;font-size:15px;line-height:1.6;">
    <p>Olá, {nome_cliente}!</p>
    <p>Escreva aqui a sua mensagem.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="https://sistemagestaogenezi.vercel.app" style="display:inline-block;background:#06b6d4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Saiba mais →</a>
    </p>
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Você recebeu este e-mail por ser aluno(a) de {nome_escola}.</p>
  </div>
</div>`;

export const LIMITE_LOTE = 10;
