import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { iniciarEnvioCampanha, processarEnvios } from "@/lib/email/marketing";

// Campanhas de e-mail marketing: dispara as AGENDADAS cujo horário já passou e continua
// as que ficaram "enviando" (uma execução tem tempo limitado, então uma campanha grande
// pode levar várias).
//
// Roda 1x por dia (ver vercel.json): o plano Hobby da Vercel só permite uma execução
// diária por cron — não dá pra rodar de hora em hora. Consequência: um agendamento sai
// na próxima execução do cron DEPOIS do horário marcado, não no minuto exato. Com um
// plano que permita, basta trocar o schedule por "0 * * * *". Um agendador externo
// (ex.: cron-job.org) chamando esta rota com o header Authorization também serve.

// Limite de duração da função (máximo do plano Hobby); o envio usa ~50s dele.
export const maxDuration = 60;

const ORCAMENTO_TOTAL_MS = 50_000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const inicio = Date.now();
  const resumo = { iniciadas: 0, processadas: 0, enviados: 0, erros: 0, falhasAoIniciar: [] as string[] };

  // 1) Agendadas vencidas -> viram "enviando".
  const { data: vencidas } = await admin
    .from("email_campanhas_marketing")
    .select("id, nome")
    .eq("status", "agendada")
    .lte("agendada_para", new Date().toISOString())
    .order("agendada_para")
    .limit(5);

  for (const campanha of vencidas ?? []) {
    const r = await iniciarEnvioCampanha(campanha.id as string);
    if (r.ok) resumo.iniciadas++;
    else resumo.falhasAoIniciar.push(`${campanha.nome}: ${r.erro}`);
  }

  // 2) Tudo que está "enviando" recebe um trecho, dentro do orçamento de tempo.
  const { data: enviando } = await admin
    .from("email_campanhas_marketing")
    .select("id")
    .eq("status", "enviando")
    .order("created_at")
    .limit(5);

  for (const campanha of enviando ?? []) {
    const restante = ORCAMENTO_TOTAL_MS - (Date.now() - inicio);
    if (restante < 12_000) break;
    const r = await processarEnvios(campanha.id as string, { orcamentoMs: restante });
    resumo.processadas++;
    resumo.enviados += r.enviados;
    resumo.erros += r.erros;
  }

  return NextResponse.json({ ok: true, ...resumo });
}
