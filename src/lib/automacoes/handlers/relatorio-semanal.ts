import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagemTelegram } from "@/lib/telegram/client";
import { calcularSaudeEscola } from "@/lib/admin/saude";

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// Disparado sexta-feira às 18h BRT (ver vercel.json e
// src/app/api/cron/relatorio-semanal/route.ts). "Semana" = últimos 7 dias
// corridos até hoje (não semana ISO seg-dom) — mais simples e sempre bate
// com o dia em que o cron roda.
export async function gerarRelatorioSemanal(): Promise<boolean> {
  const admin = createAdminClient();
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(inicioSemana.getDate() - 6);

  const fimStr = hoje.toISOString().slice(0, 10);
  const inicioStr = inicioSemana.toISOString().slice(0, 10);
  const inicioISO = `${inicioStr}T00:00:00.000Z`;
  const fimISO = `${fimStr}T23:59:59.999Z`;

  const [
    { data: parcelasPagasSemana },
    { data: avulsosSemana },
    { data: parcelasAtrasadas },
    { count: novasMatriculas },
    { count: cursosConcluidos },
    { count: certificadosEmitidos },
    { count: novosLeads },
    { count: leadsConvertidos },
    saude,
  ] = await Promise.all([
    admin.from("parcelas").select("valor").eq("status", "pago").gte("data_pagamento", inicioStr).lte("data_pagamento", fimStr),
    admin.from("pagamentos_avulsos").select("valor").gte("data_pagamento", inicioStr).lte("data_pagamento", fimStr),
    admin.from("parcelas").select("valor").eq("status", "atrasado"),
    admin.from("matriculas").select("id", { count: "exact", head: true }).gte("created_at", inicioISO).lte("created_at", fimISO),
    admin
      .from("matriculas")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluida")
      .gte("updated_at", inicioISO)
      .lte("updated_at", fimISO),
    admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .gte("emitido_em", inicioISO)
      .lte("emitido_em", fimISO),
    admin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", inicioISO).lte("created_at", fimISO),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "aluno_ativo")
      .gte("updated_at", inicioISO)
      .lte("updated_at", fimISO),
    calcularSaudeEscola(admin),
  ]);

  // Snapshots atuais (não datados na semana) — mesmo racional de
  // "inadimplência" acima: risco de evasão e pendências operacionais são
  // fotografias do estado agora, não algo que "aconteceu" na janela de 7
  // dias.
  const [{ data: indicesRisco }, { data: itensEstoque }, { count: manutencaoAbertosCount }] =
    await Promise.all([
      admin.from("indices_evasao").select("indice").gte("indice", 40),
      // Sem head:true de propósito: precisa dos valores pra comparar
      // atual < mínimo em memória — não dá pra filtrar isso com .lt() entre
      // duas colunas direto no PostgREST.
      admin.from("estoque_itens").select("quantidade_atual, quantidade_minima"),
      admin
        .from("manutencao_chamados")
        .select("id", { count: "exact", head: true })
        .in("status", ["aberto", "em_andamento"]),
    ]);

  const indices = (indicesRisco ?? []) as { indice: number }[];
  const riscoAlto = indices.filter((i) => i.indice >= 70).length;
  const riscoMedio = indices.filter((i) => i.indice >= 40 && i.indice < 70).length;

  const itensEstoqueBaixo = ((itensEstoque ?? []) as { quantidade_atual: number; quantidade_minima: number }[]).filter(
    (item) => item.quantidade_atual < item.quantidade_minima,
  ).length;

  const receitaSemana = somarValores(parcelasPagasSemana) + somarValores(avulsosSemana);
  const valorAtrasado = somarValores(parcelasAtrasadas);

  const mensagem = [
    "📈 <b>GÊNEZI — Relatório Semanal</b>",
    `📅 Semana de ${formatarData(inicioSemana)} a ${formatarData(hoje)}`,
    "",
    "💰 <b>Financeiro da semana:</b>",
    `- Receita: R$ ${formatarReais(receitaSemana)}`,
    `- Inadimplência: ${(parcelasAtrasadas ?? []).length} parcelas (R$ ${formatarReais(valorAtrasado)})`,
    "",
    "🎓 <b>Acadêmico:</b>",
    `- Novas matrículas: ${novasMatriculas ?? 0}`,
    `- Cursos concluídos: ${cursosConcluidos ?? 0}`,
    `- Certificados emitidos: ${certificadosEmitidos ?? 0}`,
    "",
    "🎯 <b>Leads:</b>",
    `- Novos leads: ${novosLeads ?? 0}`,
    `- Convertidos em alunos: ${leadsConvertidos ?? 0}`,
    "",
    "⚠️ <b>Risco de Evasão:</b>",
    `- Alunos em risco alto (≥70): ${riscoAlto}`,
    `- Alunos em risco médio (40-69): ${riscoMedio}`,
    "",
    "🏭 <b>Operacional:</b>",
    `- Itens com estoque baixo: ${itensEstoqueBaixo}`,
    `- Chamados de manutenção abertos: ${manutencaoAbertosCount ?? 0}`,
    "",
    `📊 <b>Saúde da escola:</b> ${saude.pontuacao}/100`,
  ].join("\n");

  return enviarMensagemTelegram(mensagem);
}
