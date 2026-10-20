import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPushAlunos, enviarPushParaAluno } from "@/lib/push/enviar";

export const maxDuration = 60;

type LinhaAgendamento = {
  id: string;
  titulo: string;
  corpo: string;
  destinatarios: "todos" | "ativos" | "turma";
  turma_id: string | null;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const agora = new Date().toISOString();

    const { data } = await admin
      .from("push_agendamentos")
      .select("id, titulo, corpo, destinatarios, turma_id")
      .lte("agendado_para", agora)
      .is("enviado_em", null);

    const agendamentos = (data ?? []) as LinhaAgendamento[];
    let processados = 0;

    for (const agendamento of agendamentos) {
      let totalEnviado = 0;

      if (agendamento.destinatarios === "todos") {
        totalEnviado = await enviarPushAlunos(agendamento.titulo, agendamento.corpo, "/");
      } else if (agendamento.destinatarios === "ativos") {
        const { data: alunosAtivos } = await admin.from("alunos").select("id").eq("status_aluno", "ativo");
        for (const aluno of (alunosAtivos ?? []) as { id: string }[]) {
          totalEnviado += await enviarPushParaAluno(aluno.id, agendamento.titulo, agendamento.corpo, "/");
        }
      } else if (agendamento.destinatarios === "turma" && agendamento.turma_id) {
        // alunos.turma_id é coluna legada, nunca preenchida pelo app (CLAUDE.md/comentário em
        // create_alunos.sql) — a matrícula de verdade vive em "matriculas". Resolve os alunos da
        // turma por lá, não por alunos.turma_id direto.
        const { data: matriculasDaTurma } = await admin
          .from("matriculas")
          .select("aluno_id")
          .eq("turma_id", agendamento.turma_id)
          .eq("status", "ativa");
        const alunoIds = [
          ...new Set(((matriculasDaTurma ?? []) as { aluno_id: string }[]).map((m) => m.aluno_id)),
        ];
        for (const alunoId of alunoIds) {
          totalEnviado += await enviarPushParaAluno(alunoId, agendamento.titulo, agendamento.corpo, "/");
        }
      }

      await admin
        .from("push_agendamentos")
        .update({ enviado_em: new Date().toISOString(), total_enviado: totalEnviado })
        .eq("id", agendamento.id);

      processados++;
    }

    return NextResponse.json({ processados });
  } catch (error) {
    console.error("[CRON] Erro não tratado:", error);
    return NextResponse.json({ ok: false, erro: String(error) }, { status: 500 });
  }
}
