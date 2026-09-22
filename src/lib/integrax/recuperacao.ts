// Recuperação escalonada por SMS — tipos, limites e padrões. Sem dependência de servidor (a tela e
// o cron compartilham). A tabela/cron: sms_recuperacao_config / sms_recuperacao_log e
// src/app/api/cron/sms-recuperacao.

export const RECUPERACAO_CONFIG_ID = "00000000-0000-0000-0000-000000000002";

export const RECUPERACAO_MAX_ETAPAS = 5;
export const RECUPERACAO_PRAZO_MIN_DIAS = 1;
export const RECUPERACAO_PRAZO_MAX_DIAS = 7;
export const RECUPERACAO_PRAZO_PADRAO_HORAS = 48;
export const RECUPERACAO_HORAS_MIN = 1;

// Atalhos de "quando enviar" (horas após o cadastro do lead).
export const RECUPERACAO_ATALHOS_HORAS = [1, 3, 6, 24, 48, 72] as const;

export type EtapaRecuperacao = { horas: number; mensagem: string };

// O cron roda 1x por dia (plano Hobby): uma etapa só sai na PRÓXIMA execução depois de vencida.
// Para a última etapa não ser perdida por esse atraso, o cron ainda considera o lead por mais 24h
// além do prazo. Documentado na tela.
export const RECUPERACAO_FOLGA_CRON_HORAS = 24;

export function diasParaHoras(dias: number): number {
  return dias * 24;
}

export function horasParaDias(horas: number): number {
  return Math.min(RECUPERACAO_PRAZO_MAX_DIAS, Math.max(RECUPERACAO_PRAZO_MIN_DIAS, Math.ceil(horas / 24)));
}

// Interpreta o jsonb do banco (qualquer coisa que não seja etapa válida é descartada) e ordena
// por horas — a posição na lista é o `etapa_index` do log.
export function lerEtapas(bruto: unknown): EtapaRecuperacao[] {
  if (!Array.isArray(bruto)) return [];
  const etapas: EtapaRecuperacao[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const { horas, mensagem } = item as { horas?: unknown; mensagem?: unknown };
    if (typeof horas !== "number" || !Number.isFinite(horas) || horas < RECUPERACAO_HORAS_MIN) continue;
    if (typeof mensagem !== "string" || !mensagem.trim()) continue;
    etapas.push({ horas, mensagem });
  }
  return etapas.sort((a, b) => a.horas - b.horas).slice(0, RECUPERACAO_MAX_ETAPAS);
}

export function rotuloHoras(horas: number): string {
  if (horas < 24 || horas % 24 !== 0) return `${horas}h`;
  const dias = horas / 24;
  return `${horas}h (${dias} ${dias === 1 ? "dia" : "dias"})`;
}
