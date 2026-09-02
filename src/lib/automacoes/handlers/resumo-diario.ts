import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagemTelegram } from "@/lib/telegram/client";
import { calcularFrequenciaPorTurma } from "@/lib/automacoes/handlers/frequencia-turmas";
import { FREQUENCIA_MINIMA_PERCENTUAL } from "@/lib/presencas/schema";

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarDataExtenso(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// Disparado 1x/dia às 07:30 BRT pelo Vercel Cron (ver vercel.json e
// src/app/api/cron/resumo-diario/route.ts). Usa supabaseAdmin porque roda
// sem sessão de usuário — é chamado pelo motor de automações, não por uma
// Server Action autenticada.
export async function gerarResumoDiario(): Promise<boolean> {
  const admin = createAdminClient();
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  const inicioHojeISO = `${hojeStr}T00:00:00.000Z`;

  const [
    { data: parcelasPagasHoje },
    { data: avulsosHoje },
    { count: parcelasVencendoHoje },
    { data: parcelasAtrasadas },
    { count: matriculasAtivas },
    { count: aulasRegistradasHoje },
    { count: certificadosPendentes },
    { count: totalAlunos },
    { count: loginsHoje },
    { count: leadsNovosHoje },
    { count: leadsAguardandoContato },
    { data: premiosAtivosData },
    turmasFrequencia,
  ] = await Promise.all([
    admin.from("parcelas").select("valor").eq("status", "pago").eq("data_pagamento", hojeStr),
    admin.from("pagamentos_avulsos").select("valor").eq("data_pagamento", hojeStr),
    admin
      .from("parcelas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .eq("data_vencimento", hojeStr),
    admin.from("parcelas").select("valor").eq("status", "atrasado"),
    admin.from("matriculas").select("id", { count: "exact", head: true }).eq("status", "ativa"),
    admin.from("presencas").select("id", { count: "exact", head: true }).eq("data", hojeStr),
    admin.from("certificados").select("id", { count: "exact", head: true }).eq("liberado", false),
    admin.from("alunos").select("id", { count: "exact", head: true }),
    // "Login hoje" reaproveita o próprio log do motor de automações: o
    // evento 'aluno.login' (disparado em src/app/aluno/layout.tsx) tem
    // idempotency_key com a data, então 1 evento = 1 aluno logado no dia.
    admin
      .from("eventos_automacao")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "aluno.login")
      .gte("created_at", inicioHojeISO),
    admin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", inicioHojeISO),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo"),
    // Comparação entre duas colunas (estoque <= estoque_minimo) não dá pra
    // fazer direto no filtro do PostgREST — busca os ativos com estoque
    // definido e filtra em memória logo abaixo.
    admin.from("premios").select("nome, estoque, estoque_minimo").eq("ativo", true).not("estoque", "is", null),
    // calcularFrequenciaPorTurma já faz suas próprias queries sequenciais
    // (turmas → matrículas → presenças) — só a contagem de turmas abaixo
    // do mínimo entra no resumo; o alerta individual de cada turma é
    // responsabilidade de verificarFrequenciaTurmas() (cron de evasão), pra
    // não notificar a mesma turma duas vezes por dia.
    calcularFrequenciaPorTurma(),
  ]);

  const receitaHoje = somarValores(parcelasPagasHoje) + somarValores(avulsosHoje);
  const valorAtrasado = somarValores(parcelasAtrasadas);

  const premiosEstoqueBaixo = (
    (premiosAtivosData ?? []) as { nome: string; estoque: number | null; estoque_minimo: number | null }[]
  ).filter((premio) => premio.estoque !== null && premio.estoque <= (premio.estoque_minimo ?? 5));

  const turmasBaixaFrequencia = turmasFrequencia.filter(
    (turma) => turma.percentual < FREQUENCIA_MINIMA_PERCENTUAL,
  );

  const linhas = [
    "📊 <b>GÊNEZI — Resumo do Dia</b>",
    `📅 ${formatarDataExtenso(hoje)}`,
    "",
    "💰 <b>Financeiro:</b>",
    `- Receita hoje: R$ ${formatarReais(receitaHoje)}`,
    `- Parcelas vencendo hoje: ${parcelasVencendoHoje ?? 0}`,
    `- Em atraso: ${(parcelasAtrasadas ?? []).length} parcelas (R$ ${formatarReais(valorAtrasado)})`,
    "",
    "🎓 <b>Acadêmico:</b>",
    `- Matrículas ativas: ${matriculasAtivas ?? 0}`,
    `- Aulas registradas hoje: ${aulasRegistradasHoje ?? 0}`,
    `- Certificados pendentes: ${certificadosPendentes ?? 0}`,
    "",
    "👥 <b>Alunos:</b>",
    `- Total de alunos: ${totalAlunos ?? 0}`,
    `- Logins hoje: ${loginsHoje ?? 0}`,
    "",
    "🎯 <b>Leads:</b>",
    `- Novos hoje: ${leadsNovosHoje ?? 0}`,
    `- Aguardando contato: ${leadsAguardandoContato ?? 0}`,
  ];

  // Seções condicionais (MELHORIAS 1C e 4) — só aparecem quando há algo a
  // reportar, diferente das métricas fixas acima (que sempre aparecem,
  // mesmo zeradas).
  if (premiosEstoqueBaixo.length > 0) {
    linhas.push(
      "",
      `🎁 Prêmios com estoque baixo: ${premiosEstoqueBaixo.length}`,
      ...premiosEstoqueBaixo.map((premio) => `• ${premio.nome}: ${premio.estoque} unidades restantes`),
    );
  }

  if (turmasBaixaFrequencia.length > 0) {
    linhas.push("", `🏫 Turmas com baixa frequência: ${turmasBaixaFrequencia.length}`);
  }

  return enviarMensagemTelegram(linhas.join("\n"));
}
