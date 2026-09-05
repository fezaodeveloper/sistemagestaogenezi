import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NivelBadge = { badgeId: string; limiar: number };

export const OFENSIVA_NIVEIS: NivelBadge[] = [
  { badgeId: "ofensiva_bronze", limiar: 3 },
  { badgeId: "ofensiva_prata", limiar: 7 },
  { badgeId: "ofensiva_ouro", limiar: 15 },
  { badgeId: "ofensiva_diamante", limiar: 30 },
];

export const FREQUENCIA_NIVEIS: NivelBadge[] = [
  { badgeId: "frequencia_bronze", limiar: 10 },
  { badgeId: "frequencia_prata", limiar: 25 },
  { badgeId: "frequencia_ouro", limiar: 50 },
  { badgeId: "frequencia_diamante", limiar: 100 },
];

export const MODULOS_NIVEIS: NivelBadge[] = [
  { badgeId: "modulos_bronze", limiar: 2 },
  { badgeId: "modulos_prata", limiar: 5 },
  { badgeId: "modulos_ouro", limiar: 10 },
  { badgeId: "modulos_diamante", limiar: 20 },
];

export const QUIZ_NIVEIS: NivelBadge[] = [
  { badgeId: "quiz_bronze", limiar: 5 },
  { badgeId: "quiz_prata", limiar: 15 },
  { badgeId: "quiz_ouro", limiar: 30 },
  { badgeId: "quiz_diamante", limiar: 50 },
];

export const PONTOS_NIVEIS: NivelBadge[] = [
  { badgeId: "pontos_bronze", limiar: 500 },
  { badgeId: "pontos_prata", limiar: 1000 },
  { badgeId: "pontos_ouro", limiar: 2500 },
  { badgeId: "pontos_diamante", limiar: 5000 },
];

type Admin = ReturnType<typeof createAdminClient>;

export type ContadoresProgressivos = {
  ofensivaMaxima: number;
  frequenciaCount: number;
  modulosConcluidos: number;
  quizCount: number;
  totalPontos: number;
};

// As 5 contagens usadas tanto pra conceder badge (verificarBadgesProgressivos)
// quanto pra mostrar progresso no portal do aluno (getProgressoBadgesProgressivos)
// — sempre via client admin: nenhuma dessas leituras (presencas,
// tentativas_quiz) tem RLS de select liberada pro próprio aluno (mesmo
// motivo de calcular_streak_aluno ser security definer no banco).
async function calcularContadores(admin: Admin, alunoId: string): Promise<ContadoresProgressivos> {
  const { data: matriculasData } = await admin
    .from("matriculas")
    .select("id, turmas(curso_id)")
    .eq("aluno_id", alunoId);

  const matriculas = (matriculasData ?? []) as unknown as {
    id: string;
    turmas: { curso_id: string } | null;
  }[];
  const matriculaIds = matriculas.map((m) => m.id);
  const cursoIds = [...new Set(matriculas.map((m) => m.turmas?.curso_id).filter(Boolean))] as string[];

  const { data: ofensivasData } = await admin
    .from("ofensivas")
    .select("ofensiva_maxima")
    .eq("aluno_id", alunoId);
  const ofensivaMaxima = (ofensivasData ?? []).reduce(
    (maior, o) => Math.max(maior, o.ofensiva_maxima as number),
    0,
  );

  let frequenciaCount = 0;
  let quizCount = 0;
  if (matriculaIds.length > 0) {
    const [{ count: freq }, { count: quiz }] = await Promise.all([
      admin
        .from("presencas")
        .select("id", { count: "exact", head: true })
        .in("matricula_id", matriculaIds)
        .in("status", ["presente", "reposicao"]),
      admin
        .from("tentativas_quiz")
        .select("id", { count: "exact", head: true })
        .in("matricula_id", matriculaIds),
    ]);
    frequenciaCount = freq ?? 0;
    quizCount = quiz ?? 0;
  }

  // Mesmo raciocínio do badge "modulo_completo" existente
  // (verificar_conquistas_aluno, migration 20260822100000): módulo com
  // pelo menos 1 aula, todas concluídas em qualquer matrícula do aluno —
  // só que aqui é uma contagem, não uma existência.
  let modulosConcluidos = 0;
  if (cursoIds.length > 0) {
    const [{ data: modulosData }, { data: concluidasData }] = await Promise.all([
      admin.from("modulos").select("id, aulas(id)").in("curso_id", cursoIds),
      matriculaIds.length > 0
        ? admin.from("aulas_concluidas").select("aula_id").in("matricula_id", matriculaIds)
        : Promise.resolve({ data: [] as { aula_id: string }[] }),
    ]);

    const concluidasSet = new Set((concluidasData ?? []).map((c) => c.aula_id as string));
    for (const modulo of (modulosData ?? []) as { id: string; aulas: { id: string }[] | null }[]) {
      const aulaIds = modulo.aulas?.map((a) => a.id) ?? [];
      if (aulaIds.length > 0 && aulaIds.every((id) => concluidasSet.has(id))) {
        modulosConcluidos += 1;
      }
    }
  }

  const { data: rankingData } = await admin
    .from("ranking_geral")
    .select("total_pontos")
    .eq("aluno_id", alunoId)
    .maybeSingle();

  return {
    ofensivaMaxima,
    frequenciaCount,
    modulosConcluidos,
    quizCount,
    totalPontos: (rankingData?.total_pontos as number | undefined) ?? 0,
  };
}

async function concederBadges(
  admin: Admin,
  alunoId: string,
  valor: number,
  niveis: NivelBadge[],
): Promise<void> {
  const badgeIds = niveis.filter((nivel) => valor >= nivel.limiar).map((nivel) => nivel.badgeId);
  if (badgeIds.length === 0) return;

  await admin.from("badges_conquistados").upsert(
    badgeIds.map((badgeId) => ({ aluno_id: alunoId, badge_id: badgeId, created_by: alunoId })),
    { onConflict: "aluno_id,badge_id", ignoreDuplicates: true },
  );
}

// Verifica e concede automaticamente os badges progressivos (ofensiva,
// frequência, módulos, quiz, pontos). badges_conquistados não tem grant de
// insert pra authenticated (só service_role ou a function
// verificar_conquistas_aluno, específica dos 6 badges antigos) — por isso
// sempre via client admin, mesmo quando chamado a partir da sessão do
// próprio aluno (aluno/layout.tsx). Best-effort: chamado tanto no login do
// aluno quanto no cron diário, nunca deve lançar pro chamador.
export async function verificarBadgesProgressivos(alunoId: string): Promise<void> {
  const admin = createAdminClient();
  const contadores = await calcularContadores(admin, alunoId);

  await Promise.all([
    concederBadges(admin, alunoId, contadores.ofensivaMaxima, OFENSIVA_NIVEIS),
    concederBadges(admin, alunoId, contadores.frequenciaCount, FREQUENCIA_NIVEIS),
    concederBadges(admin, alunoId, contadores.modulosConcluidos, MODULOS_NIVEIS),
    concederBadges(admin, alunoId, contadores.quizCount, QUIZ_NIVEIS),
    concederBadges(admin, alunoId, contadores.totalPontos, PONTOS_NIVEIS),
  ]);
}

// Mesmas 5 contagens, só leitura — usado pra desenhar a barra de progresso
// das medalhas progressivas no portal do aluno (/aluno/ranking) sem
// conceder nada.
export async function getProgressoBadgesProgressivos(alunoId: string): Promise<ContadoresProgressivos> {
  const admin = createAdminClient();
  return calcularContadores(admin, alunoId);
}
