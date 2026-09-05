import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adicionarDias, diaDaSemana, hojeISO } from "@/lib/datas/util";
import { getFeriadosTurma } from "@/lib/calendario/feriados-turma";
import { verificarBadgesProgressivos } from "@/lib/gamificacao/badges-progressivos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type OfensivaCalculada = {
  ofensiva_atual: number;
  ofensiva_maxima: number;
  ultima_aula_cumprida: string | null;
};

const OFENSIVA_ZERADA: OfensivaCalculada = {
  ofensiva_atual: 0,
  ofensiva_maxima: 0,
  ultima_aula_cumprida: null,
};

type MatriculaTurmaRow = {
  turma_id: string;
  turmas: {
    cadencia_dias_semana: string[] | null;
    data_inicio: string;
    data_fim: string;
    curso_id: string;
  } | null;
};

// Ofensiva = sequência de "dias de aula esperados" (segundo a cadência da
// turma) em que o aluno esteve presente ou em reposição, sem quebra — dias
// de feriado, ou em que ainda não houve chamada, não contam nem quebram a
// sequência (só uma falta/justificada explícita quebra).
export async function calcularOfensivaAluno(
  alunoId: string,
  matriculaId: string,
  supabase: SupabaseServerClient,
): Promise<OfensivaCalculada> {
  const { data: matricula } = await supabase
    .from("matriculas")
    .select("turma_id, turmas(cadencia_dias_semana, data_inicio, data_fim, curso_id)")
    .eq("id", matriculaId)
    .maybeSingle();

  const turma = (matricula as MatriculaTurmaRow | null)?.turmas;
  // Curso EAD (ou turma presencial/híbrida ainda sem cadência configurada)
  // não tem cronograma fixo — ofensiva não se aplica.
  if (!turma || !turma.cadencia_dias_semana || turma.cadencia_dias_semana.length === 0) {
    return OFENSIVA_ZERADA;
  }

  const hoje = hojeISO();
  // Nunca olha além de hoje nem além do fim da turma — o que vier primeiro.
  const dataFimBusca = turma.data_fim < hoje ? turma.data_fim : hoje;
  if (turma.data_inicio > dataFimBusca) return OFENSIVA_ZERADA;

  const feriados = await getFeriadosTurma(supabase, {
    turmaId: matricula!.turma_id,
    cursoId: turma.curso_id,
    dataInicio: turma.data_inicio,
    dataFim: dataFimBusca,
  });

  const cadencia = new Set(turma.cadencia_dias_semana);
  const diasEsperados: string[] = [];
  for (let dia = turma.data_inicio; dia <= dataFimBusca; dia = adicionarDias(dia, 1)) {
    if (!cadencia.has(diaDaSemana(dia))) continue;
    if (feriados.has(dia)) continue;
    diasEsperados.push(dia);
  }

  if (diasEsperados.length === 0) return OFENSIVA_ZERADA;

  const { data: presencasData } = await supabase
    .from("presencas")
    .select("data, status")
    .eq("matricula_id", matriculaId);

  const statusPorData = new Map<string, string>(
    (presencasData ?? []).map((p) => [p.data as string, p.status as string]),
  );

  // Um único passe (do dia mais antigo pro mais recente) calcula ofensiva
  // atual e máxima ao mesmo tempo: "atual" é o valor da sequência no fim do
  // laço (o trecho contínuo mais recente); "máxima" é o maior valor que a
  // sequência atingiu em qualquer ponto do histórico. Dia sem chamada ainda
  // registrada não reseta nem incrementa — só é ignorado.
  let sequenciaAtual = 0;
  let maiorSequencia = 0;
  let ultimaAulaCumprida: string | null = null;

  for (const dia of diasEsperados) {
    const status = statusPorData.get(dia);
    if (status === "presente" || status === "reposicao") {
      sequenciaAtual += 1;
      ultimaAulaCumprida = dia;
      maiorSequencia = Math.max(maiorSequencia, sequenciaAtual);
    } else if (status === "falta" || status === "justificada") {
      sequenciaAtual = 0;
      ultimaAulaCumprida = null;
    }
  }

  return {
    ofensiva_atual: sequenciaAtual,
    ofensiva_maxima: Math.max(maiorSequencia, sequenciaAtual),
    ultima_aula_cumprida: ultimaAulaCumprida,
  };
}

// Recalcula a ofensiva de todas as matrículas ativas do aluno e faz upsert
// em `ofensivas`. Sempre via client admin: a tabela só concede
// insert/update/delete pra service_role (aluno só tem select da própria
// linha) — mesmo motivo de verificarBadgesProgressivos usar admin
// internamente. Best-effort: quem chama decide o que fazer com uma falha
// (nunca deve travar login nem o cron).
export async function atualizarOfensivasAluno(alunoId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: matriculas } = await admin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("status", "ativa");

  for (const matricula of matriculas ?? []) {
    const resultado = await calcularOfensivaAluno(alunoId, matricula.id as string, admin);

    await admin.from("ofensivas").upsert(
      {
        aluno_id: alunoId,
        matricula_id: matricula.id,
        ofensiva_atual: resultado.ofensiva_atual,
        ofensiva_maxima: resultado.ofensiva_maxima,
        ultima_aula_cumprida: resultado.ultima_aula_cumprida,
        calculado_em: new Date().toISOString(),
      },
      { onConflict: "aluno_id,matricula_id" },
    );
  }

  await verificarBadgesProgressivos(alunoId);
}
