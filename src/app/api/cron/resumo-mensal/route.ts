import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { calcularSaudeEscola } from "@/lib/admin/saude";

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

// Disparado 1x/mês, dia 1 às 10:00 UTC (07:00 BRT) pelo Vercel Cron (ver
// vercel.json). Confere o dia em BRT (UTC-3) antes de rodar — mesmo motivo
// de ehSextaFeiraBRT em relatorio-semanal/route.ts (protege contra
// trigger manual/replay fora do dia certo).
function ehDiaPrimeiroBRT(): boolean {
  const agoraBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return agoraBRT.getUTCDate() === 1;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!ehDiaPrimeiroBRT()) {
    return NextResponse.json({ ok: true, ignorado: "não é dia 1 do mês" });
  }

  const admin = createAdminClient();
  const hoje = new Date();
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const ano = mesAnterior.getFullYear();
  const mes = mesAnterior.getMonth() + 1;
  const inicioStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimStr = new Date(ano, mes, 0).toISOString().slice(0, 10);
  const inicioISO = `${inicioStr}T00:00:00.000Z`;
  const fimISO = `${fimStr}T23:59:59.999Z`;

  const [
    { data: parcelasPagas },
    { data: avulsos },
    { data: parcelasAtrasadas },
    { count: novasMatriculas },
    { count: certificadosEmitidos },
    { count: leadsCaptados },
    saude,
  ] = await Promise.all([
    admin
      .from("parcelas")
      .select("valor")
      .eq("status", "pago")
      .gte("data_pagamento", inicioStr)
      .lte("data_pagamento", fimStr),
    admin.from("pagamentos_avulsos").select("valor").gte("data_pagamento", inicioStr).lte("data_pagamento", fimStr),
    // Inadimplência é uma fotografia do estado atual (mesmo racional de
    // resumo-diario/relatorio-semanal), não algo datado no mês anterior.
    admin.from("parcelas").select("valor").eq("status", "atrasado"),
    admin.from("matriculas").select("id", { count: "exact", head: true }).gte("created_at", inicioISO).lte("created_at", fimISO),
    admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .gte("emitido_em", inicioISO)
      .lte("emitido_em", fimISO),
    admin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", inicioISO).lte("created_at", fimISO),
    calcularSaudeEscola(admin),
  ]);

  const receita = somarValores(parcelasPagas) + somarValores(avulsos);
  const valorAtrasado = somarValores(parcelasAtrasadas);

  await dispararEvento(
    "resumo.mensal",
    {
      mes,
      ano,
      receita,
      parcelas_atrasadas: (parcelasAtrasadas ?? []).length,
      valor_atrasado: valorAtrasado,
      novas_matriculas: novasMatriculas ?? 0,
      certificados_emitidos: certificadosEmitidos ?? 0,
      leads_captados: leadsCaptados ?? 0,
      pontuacao: saude.pontuacao,
    },
    `resumo-mensal-${ano}-${mes}`,
  );

  return NextResponse.json({ ok: true });
}
