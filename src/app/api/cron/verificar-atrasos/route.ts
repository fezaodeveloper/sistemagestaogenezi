import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { verificarLeadsSemContato } from "@/lib/leads/leads";

const DIAS_CONTRATO_PENDENTE = 3;

// Disparado 1x/dia às 11:00 UTC (08:00 BRT) pelo Vercel Cron (ver
// vercel.json) — varre parcelas pendentes vencidas, marca como atrasadas e
// notifica só as que acabaram de virar atrasadas nesta execução (não
// renotifica quem já estava atrasado de execuções anteriores). Também
// aproveita a mesma execução diária pra três outras verificações "de
// pendência" (TAREFA 9B): parcelas vencendo amanhã, contratos parados há
// dias e leads sem contato — todas idempotentes via idempotency_key datada,
// então não reenviam a mesma notificação em execuções seguintes.
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

  let atualizadas = 0;
  if (parcelasVencidas.length > 0) {
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
    atualizadas = parcelasVencidas.length;
  }

  // Parcelas vencendo amanhã.
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().slice(0, 10);

  const { data: vencendoAmanha } = await admin
    .from("parcelas")
    .select("id, valor, data_vencimento, alunos(full_name)")
    .eq("status", "pendente")
    .eq("data_vencimento", amanhaStr);

  for (const parcela of (vencendoAmanha ?? []) as unknown as {
    id: string;
    valor: number;
    data_vencimento: string;
    alunos: { full_name: string | null } | null;
  }[]) {
    await dispararEvento(
      "parcela.vencendo.amanha",
      {
        valor: parcela.valor,
        nome_aluno: parcela.alunos?.full_name ?? "—",
        data_vencimento: parcela.data_vencimento,
      },
      `parcela-vencendo-${parcela.id}-${amanhaStr}`,
    );
  }

  // Contratos parados (nem assinados nem recusados) há mais de 3 dias.
  const limiteContrato = new Date();
  limiteContrato.setDate(limiteContrato.getDate() - DIAS_CONTRATO_PENDENTE);

  const { data: contratosPendentes } = await admin
    .from("contratos_assinados")
    .select("id, created_at, alunos(profiles!alunos_id_fkey(full_name))")
    .eq("status", "pendente")
    .lt("created_at", limiteContrato.toISOString());

  for (const contrato of (contratosPendentes ?? []) as unknown as {
    id: string;
    created_at: string;
    alunos: { profiles: { full_name: string | null } | null } | null;
  }[]) {
    const dias = Math.floor((Date.now() - new Date(contrato.created_at).getTime()) / 86400000);
    await dispararEvento(
      "contrato.pendente",
      { nome_aluno: contrato.alunos?.profiles?.full_name ?? "—", dias },
      `contrato-pendente-${contrato.id}-${hoje}`,
    );
  }

  // Leads sem contato há mais de 7 dias.
  const leadsSemContato = await verificarLeadsSemContato(admin);
  for (const lead of leadsSemContato) {
    await dispararEvento(
      "lead.sem.contato",
      { nome: lead.nome, telefone: lead.telefone, dias: lead.dias },
      `lead-sem-contato-${lead.id}-${hoje}`,
    );
  }

  return NextResponse.json({ atualizadas });
}
