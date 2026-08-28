import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularIndiceEvasao } from "@/lib/evasao/calculo";
import { dispararEvento } from "@/lib/automacoes/motor";

const LIMIAR_ALERTA = 70;

// Disparado 1x/dia às 12:00 UTC (09:00 BRT) pelo Vercel Cron (ver
// vercel.json) — recalcula o índice de risco de evasão de toda matrícula
// ativa e faz upsert em indices_evasao. alerta_enviado reseta pra false
// quando o índice cai abaixo do limiar, pra permitir um novo alerta se o
// risco voltar a subir depois.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: matriculasData } = await admin
    .from("matriculas")
    .select("id, aluno_id, alunos(full_name), turmas(cursos(nome))")
    .eq("status", "ativa");

  const matriculas = (matriculasData ?? []) as unknown as {
    id: string;
    aluno_id: string;
    alunos: { full_name: string | null } | null;
    turmas: { cursos: { nome: string } | null } | null;
  }[];

  let processados = 0;
  let alertas = 0;

  for (const matricula of matriculas) {
    const componentes = await calcularIndiceEvasao(matricula.aluno_id, matricula.id);

    const { data: existente } = await admin
      .from("indices_evasao")
      .select("alerta_enviado")
      .eq("aluno_id", matricula.aluno_id)
      .eq("matricula_id", matricula.id)
      .maybeSingle();

    const emRisco = componentes.total >= LIMIAR_ALERTA;
    // Só dispara um alerta novo se acabou de entrar em risco (não tinha
    // alerta_enviado=true ainda); se caiu abaixo do limiar, reseta pra
    // false pra permitir um novo alerta caso volte a subir depois.
    const deveAlertar = emRisco && !existente?.alerta_enviado;
    const alertaEnviado = emRisco ? existente?.alerta_enviado === true || deveAlertar : false;

    await admin.from("indices_evasao").upsert(
      {
        aluno_id: matricula.aluno_id,
        matricula_id: matricula.id,
        indice: componentes.total,
        componente_faltas: componentes.faltas,
        componente_financeiro: componentes.financeiro,
        componente_inatividade: componentes.inatividade,
        componente_notas: componentes.notas,
        motivos: componentes.motivos,
        alerta_enviado: alertaEnviado,
        calculado_em: new Date().toISOString(),
      },
      { onConflict: "aluno_id,matricula_id" },
    );

    processados += 1;

    if (deveAlertar) {
      await dispararEvento(
        "evasao.risco",
        {
          nome_aluno: matricula.alunos?.full_name ?? "—",
          nome_curso: matricula.turmas?.cursos?.nome ?? "—",
          indice: componentes.total,
          motivos: componentes.motivos,
          matricula_id: matricula.id,
        },
        `evasao-risco-${matricula.id}-${hoje}`,
      );
      alertas += 1;
    }
  }

  return NextResponse.json({ processados, alertas });
}
