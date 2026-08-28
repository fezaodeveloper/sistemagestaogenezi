import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ComponentesEvasao {
  faltas: number; // 0-40 pontos
  financeiro: number; // 0-30 pontos
  inatividade: number; // 0-20 pontos
  notas: number; // 0-10 pontos
  total: number; // soma (0-100)
  motivos: string[];
}

const JANELA_FALTAS_DIAS = 30;

// Interpolação linear entre pontos de referência (percentual -> pontos) —
// usado só no componente de faltas, que tem 4 pontos de referência
// definidos (0%→0, 25%→10, 50%→20, 75%+→40) em vez de faixas fixas.
function interpolarPontosFaltas(percentualFaltas: number): number {
  const pontos: [number, number][] = [
    [0, 0],
    [25, 10],
    [50, 20],
    [75, 40],
  ];

  if (percentualFaltas <= 0) return 0;
  if (percentualFaltas >= 75) return 40;

  for (let i = 0; i < pontos.length - 1; i++) {
    const [pA, vA] = pontos[i];
    const [pB, vB] = pontos[i + 1];
    if (percentualFaltas >= pA && percentualFaltas <= pB) {
      const fracao = (percentualFaltas - pA) / (pB - pA);
      return Math.round(vA + fracao * (vB - vA));
    }
  }

  return 40;
}

function pontosFinanceiro(parcelasAtrasadas: number): number {
  if (parcelasAtrasadas >= 3) return 30;
  if (parcelasAtrasadas === 2) return 20;
  if (parcelasAtrasadas === 1) return 10;
  return 0;
}

function pontosInatividade(diasSemLogin: number | null): number {
  if (diasSemLogin === null) return 20; // nunca logou — mesma faixa de "mais de 30 dias"
  if (diasSemLogin > 30) return 20;
  if (diasSemLogin >= 15) return 10;
  if (diasSemLogin >= 7) return 5;
  return 0;
}

function pontosNotas(aproveitamento: number | null): number {
  if (aproveitamento === null) return 0; // ainda em andamento
  if (aproveitamento < 60) return 10;
  if (aproveitamento <= 70) return 5;
  return 0;
}

// Calcula o índice de risco de evasão de um aluno numa matrícula específica
// (0-100, quanto maior pior). Chamado pelo cron diário
// src/app/api/cron/calcular-evasao/route.ts — sempre com supabaseAdmin,
// porque roda sem sessão de usuário.
export async function calcularIndiceEvasao(
  alunoId: string,
  matriculaId: string,
): Promise<ComponentesEvasao> {
  const admin = createAdminClient();
  const motivos: string[] = [];

  const dataLimiteFaltas = new Date();
  dataLimiteFaltas.setDate(dataLimiteFaltas.getDate() - JANELA_FALTAS_DIAS);
  const dataLimiteFaltasStr = dataLimiteFaltas.toISOString().slice(0, 10);

  const [{ data: presencasData }, { count: parcelasAtrasadas }, { data: ultimoLogin }, { data: certificado }] =
    await Promise.all([
      admin
        .from("presencas")
        .select("status")
        .eq("matricula_id", matriculaId)
        .gte("data", dataLimiteFaltasStr),
      admin
        .from("parcelas")
        .select("id", { count: "exact", head: true })
        .eq("matricula_id", matriculaId)
        .eq("status", "atrasado"),
      admin
        .from("eventos_automacao")
        .select("created_at")
        .eq("tipo", "aluno.login")
        .like("idempotency_key", `aluno-login-${alunoId}-%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("certificados")
        .select("aproveitamento_percentual")
        .eq("matricula_id", matriculaId)
        .maybeSingle(),
    ]);

  // Componente Faltas
  const presencas = (presencasData ?? []) as { status: string }[];
  const totalPresencas = presencas.length;
  const faltasEJustificadas = presencas.filter(
    (p) => p.status === "falta" || p.status === "justificada",
  ).length;
  const percentualFaltas = totalPresencas > 0 ? (faltasEJustificadas / totalPresencas) * 100 : 0;
  const pontosFaltas = interpolarPontosFaltas(percentualFaltas);
  if (pontosFaltas > 10) {
    motivos.push(`Alta taxa de faltas (${Math.round(percentualFaltas)}%)`);
  }

  // Componente Financeiro
  const pontosFinanceiroValor = pontosFinanceiro(parcelasAtrasadas ?? 0);
  if ((parcelasAtrasadas ?? 0) > 0) {
    motivos.push(`${parcelasAtrasadas} parcela(s) em atraso`);
  }

  // Componente Inatividade EAD
  let diasSemLogin: number | null = null;
  if (ultimoLogin?.created_at) {
    const diffMs = Date.now() - new Date(ultimoLogin.created_at).getTime();
    diasSemLogin = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  const pontosInatividadeValor = pontosInatividade(diasSemLogin);
  if (pontosInatividadeValor > 0) {
    motivos.push(
      diasSemLogin === null
        ? "Nunca acessou a plataforma"
        : `Sem acesso há ${diasSemLogin} dias`,
    );
  }

  // Componente Notas
  const aproveitamento = certificado?.aproveitamento_percentual ?? null;
  const pontosNotasValor = pontosNotas(aproveitamento);
  if (pontosNotasValor > 0) {
    motivos.push(`Nota abaixo do mínimo (${aproveitamento}%)`);
  }

  return {
    faltas: pontosFaltas,
    financeiro: pontosFinanceiroValor,
    inatividade: pontosInatividadeValor,
    notas: pontosNotasValor,
    total: pontosFaltas + pontosFinanceiroValor + pontosInatividadeValor + pontosNotasValor,
    motivos,
  };
}
