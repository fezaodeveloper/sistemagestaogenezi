import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";

// Disparado 1x/dia às 11:00 UTC (08:00 BRT) pelo Vercel Cron (ver
// vercel.json) — varre parcelas pendentes vencidas, marca como atrasadas e
// notifica só as que acabaram de virar atrasadas nesta execução (não
// renotifica quem já estava atrasado de execuções anteriores).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: vencidas } = await admin
    .from("parcelas")
    .select("id, valor, data_vencimento, alunos(full_name)")
    .eq("status", "pendente")
    .lt("data_vencimento", hoje);

  const parcelasVencidas = (vencidas ?? []) as unknown as {
    id: string;
    valor: number;
    data_vencimento: string;
    alunos: { full_name: string | null } | null;
  }[];

  if (parcelasVencidas.length === 0) {
    return NextResponse.json({ atualizadas: 0 });
  }

  const ids = parcelasVencidas.map((parcela) => parcela.id);
  const { error } = await admin.from("parcelas").update({ status: "atrasado" }).in("id", ids);

  if (error) {
    return NextResponse.json({ error: "Não foi possível atualizar as parcelas." }, { status: 500 });
  }

  for (const parcela of parcelasVencidas) {
    await dispararEvento(
      "pagamento.atrasado",
      {
        valor: parcela.valor,
        nome_aluno: parcela.alunos?.full_name ?? "—",
        data_vencimento: parcela.data_vencimento,
      },
      `pagamento-atrasado-${parcela.id}-${hoje}`,
    );
  }

  return NextResponse.json({ atualizadas: parcelasVencidas.length });
}
