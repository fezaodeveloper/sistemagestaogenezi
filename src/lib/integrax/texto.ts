// Utilitários de TEXTO de SMS, sem dependência de servidor — a tela de templates (client) e o envio
// (server) compartilham. `sms.ts` re-exporta estes dois nomes, então nenhum import existente muda.

export const SMS_LIMITE_CARACTERES = 160;

// Só GSM-7 cabe em 160 caracteres por SMS; um único "ã" ou "ê" muda o SMS pra
// UCS-2 (70 por parte). Tira acentos e troca aspas/travessões "inteligentes".
export function normalizarTextoSms(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
