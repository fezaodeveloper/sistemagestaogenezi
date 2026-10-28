import { NextResponse } from "next/server";
import { buscarCobrancaAsaas } from "@/lib/asaas/client";

// Pública de propósito — consultada pelo polling client-side de
// /conecta/aguardando-pagamento (candidato ainda sem sessão). paymentId é o mesmo id já exposto
// na própria URL (?payment=<id>, ver redirect em cadastrarCandidatoExterno) — não expõe nada que
// o candidato já não tenha em mãos.
const STATUS_PAGOS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export async function GET(request: Request) {
  const paymentId = new URL(request.url).searchParams.get("payment");
  if (!paymentId) {
    return NextResponse.json({ error: "payment ausente" }, { status: 400 });
  }

  try {
    const cobranca = await buscarCobrancaAsaas(paymentId);
    return NextResponse.json({ pago: STATUS_PAGOS.has(cobranca.status) });
  } catch {
    return NextResponse.json({ pago: false });
  }
}
