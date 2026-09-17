import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { adicionarEntradaNotas, formatarEntradaFollowup } from "@/lib/leads/leads";
import { FOLLOWUP_AUTOMATICO_LIMITE } from "@/lib/leads/schema";

// Disparado 1x/dia às 09:00 UTC (ver vercel.json) — CRM Kanban, roadmap item
// 3. Sem Evolution API ainda: o "follow-up automático" é só um stub
// (console.log) que registra a intenção e avança o contador; a integração
// de envio de verdade entra depois, sem precisar mexer nesse fluxo.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: leads } = await admin
    .from("leads")
    .select("id, nome, telefone, notas, followup_count")
    .in("kanban_coluna", ["novo", "contato", "negociacao"])
    .lte("proxima_acao", hoje)
    .lt("followup_count", FOLLOWUP_AUTOMATICO_LIMITE);

  const leadsParaFollowup = (leads ?? []) as {
    id: string;
    nome: string;
    telefone: string;
    notas: string | null;
    followup_count: number;
  }[];

  let contatados = 0;
  let aguardamAcaoManual = 0;

  for (const lead of leadsParaFollowup) {
    // Stub — Evolution API virá depois. Por enquanto só loga a intenção de
    // contato automático pra esse lead.
    console.log(`[followup-leads] Follow-up automático (stub) para lead ${lead.id} (${lead.nome})`);

    const novoCount = lead.followup_count + 1;
    const atingiuLimite = novoCount >= FOLLOWUP_AUTOMATICO_LIMITE;

    let notasAtualizadas = adicionarEntradaNotas(lead.notas, formatarEntradaFollowup("Follow-up automático (stub)"));
    if (atingiuLimite) {
      notasAtualizadas = adicionarEntradaNotas(
        notasAtualizadas,
        formatarEntradaFollowup("⚠️ Follow-up automático encerrado — contato manual necessário"),
      );
    }

    const { error } = await admin
      .from("leads")
      .update({
        notas: notasAtualizadas,
        followup_count: novoCount,
        ultimo_followup: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (error) continue;

    contatados += 1;
    if (atingiuLimite) aguardamAcaoManual += 1;
  }

  await dispararEvento(
    "lead.followup.resumo",
    { contatados, aguardamAcaoManual },
    `lead-followup-resumo-${hoje}`,
  );

  return NextResponse.json({ contatados, aguardamAcaoManual });
}
