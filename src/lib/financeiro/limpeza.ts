import "server-only";

import { cancelarCobrancaAsaas } from "@/lib/asaas/client";

// Cobranças ainda em aberto no Asaas (pendente/atrasado) são canceladas quando
// a parcela local vai ser apagada — senão o aluno continuaria recebendo/
// pagando um boleto de uma parcela que não existe mais no sistema. Chamada
// DEPOIS de o delete local ter dado certo (se o delete falhar, nada foi
// cancelado no Asaas). Parcelas já PAGAS não são mexidas aqui: cancelar no
// Asaas exigiria estorno, que é decisão do admin (ver estornarCobrancaAsaas).
//
// Best-effort: uma falha isolada (Asaas fora do ar, chave não configurada,
// cobrança já cancelada) não impede nada — só é contada e devolvida pro
// admin ser avisado.
export async function cancelarCobrancasAsaasPendentes(
  parcelas: { status: string; asaas_payment_id: string | null }[],
): Promise<number> {
  let falhas = 0;
  for (const parcela of parcelas) {
    if (!parcela.asaas_payment_id) continue;
    if (parcela.status !== "pendente" && parcela.status !== "atrasado") continue;
    try {
      await cancelarCobrancaAsaas(parcela.asaas_payment_id);
    } catch (erro) {
      falhas += 1;
      console.error("[financeiro] não foi possível cancelar a cobrança no Asaas:", parcela.asaas_payment_id, erro);
    }
  }
  return falhas;
}
