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

// Retorna só os badge_id que foram DE FATO inseridos agora (não os que já
// existiam) — ignoreDuplicates vira "on conflict do nothing" no Postgres,
// então .select() aqui devolve apenas as linhas realmente novas. Usado por
// concederRecompensasDeBadges pra só processar recompensa de badge recém
// conquistado, nunca reprocessar um badge antigo a cada verificação.
async function concederBadges(
  admin: Admin,
  alunoId: string,
  valor: number,
  niveis: NivelBadge[],
): Promise<string[]> {
  const badgeIds = niveis.filter((nivel) => valor >= nivel.limiar).map((nivel) => nivel.badgeId);
  if (badgeIds.length === 0) return [];

  const { data } = await admin
    .from("badges_conquistados")
    .upsert(
      badgeIds.map((badgeId) => ({ aluno_id: alunoId, badge_id: badgeId, created_by: alunoId })),
      { onConflict: "aluno_id,badge_id", ignoreDuplicates: true },
    )
    .select("badge_id");

  return (data ?? []).map((row) => row.badge_id as string);
}

type MedalhaRecompensa = {
  id: string;
  badge_id: string;
  tipo: "premio" | "curso";
  premio_id: string | null;
  curso_id: string | null;
  prazo_entrega_dias: number | null;
};

// 1 crédito = 50 pontos (mesma proporção de creditos_saldo, migration
// 20260823100000) — pra "adicionar créditos suficientes" (opção escolhida
// em revisão, em vez de resgatar automaticamente), lança um bônus de
// pontos equivalente ao custo do prêmio em créditos. O aluno resgata o
// prêmio manualmente depois, quando quiser, com o saldo já disponível.
const PONTOS_POR_CREDITO = 50;

async function concederRecompensaPremio(
  admin: Admin,
  alunoId: string,
  recompensa: MedalhaRecompensa,
): Promise<void> {
  if (!recompensa.premio_id) return;

  const { data: premio } = await admin
    .from("premios")
    .select("custo_creditos")
    .eq("id", recompensa.premio_id)
    .maybeSingle();
  if (!premio) return;

  // pontos_eventos exige uma matrícula — a recompensa é do aluno, não de
  // um curso específico, então usa a matrícula mais recente dele (os
  // pontos entram no total agregado por aluno em ranking_geral/
  // creditos_saldo de qualquer forma, independente de qual matrícula
  // "hospeda" o evento).
  const { data: matricula } = await admin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!matricula) return;

  const pontosCreditados = premio.custo_creditos * PONTOS_POR_CREDITO;

  const { error: pontosError } = await admin.from("pontos_eventos").upsert(
    {
      matricula_id: matricula.id,
      tipo_evento: "recompensa_medalha",
      pontos: pontosCreditados,
      referencia_id: recompensa.id,
    },
    { onConflict: "matricula_id,tipo_evento,referencia_id", ignoreDuplicates: true },
  );
  if (pontosError) {
    console.error(
      `[RECOMPENSA PREMIO] Erro ao creditar pontos (recompensa ${recompensa.id}, aluno ${alunoId}):`,
      pontosError,
    );
  }

  // prazo_entrega_dias só é preenchido pelo admin quando o prêmio vinculado
  // é físico ou híbrido (ver AdicionarRecompensaDialog) — quando ausente
  // (prêmio digital), prazo_entrega_ate fica null.
  let prazoEntregaAte: string | null = null;
  if (recompensa.prazo_entrega_dias) {
    const data = new Date();
    data.setDate(data.getDate() + recompensa.prazo_entrega_dias);
    prazoEntregaAte = data.toISOString().slice(0, 10);
  }

  const { error: resgateError } = await admin.from("medalha_recompensas_resgatadas").upsert(
    {
      aluno_id: alunoId,
      recompensa_id: recompensa.id,
      badge_id: recompensa.badge_id,
      tipo: "premio",
      pontos_creditados: pontosCreditados,
      prazo_entrega_ate: prazoEntregaAte,
    },
    { onConflict: "aluno_id,recompensa_id", ignoreDuplicates: true },
  );
  if (resgateError) {
    console.error(
      `[RECOMPENSA PREMIO] Erro ao registrar resgate (recompensa ${recompensa.id}, aluno ${alunoId}):`,
      resgateError,
    );
  }
}

// Mesma lógica de seleção de turma de resgatar_curso_bonus (migration
// 20260823100000): turma ativa mais recente do curso. Diferente do resgate
// por créditos, aqui não há checagem de saldo/limite — é uma recompensa
// grátis por ter conquistado o badge.
async function concederRecompensaCurso(
  admin: Admin,
  alunoId: string,
  recompensa: MedalhaRecompensa,
): Promise<void> {
  if (!recompensa.curso_id) return;

  const { data: turma } = await admin
    .from("turmas")
    .select("id")
    .eq("curso_id", recompensa.curso_id)
    .eq("status", "ativa")
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!turma) return;

  const { data: matriculaExistente } = await admin
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("turma_id", turma.id)
    .eq("status", "ativa")
    .maybeSingle();
  if (matriculaExistente) return;

  // created_by é not null (default auth.uid()) — sem sessão de usuário no
  // client admin (service_role), o default resolve pra null e o INSERT
  // falhava em silêncio (supabase-js retorna { error }, não lança exceção).
  // Mesmo valor que resgatar_curso_bonus grava pra essa coluna quando o
  // próprio aluno resgata (auth.uid() ali = o aluno autenticado).
  const { data: novaMatricula, error: matriculaError } = await admin
    .from("matriculas")
    .insert({ aluno_id: alunoId, turma_id: turma.id, status: "ativa", created_by: alunoId })
    .select("id")
    .single();
  if (matriculaError) {
    console.error(
      `[RECOMPENSA CURSO] Erro ao criar matrícula (recompensa ${recompensa.id}, aluno ${alunoId}):`,
      matriculaError,
    );
  }
  if (!novaMatricula) return;

  const { error: resgateError } = await admin.from("medalha_recompensas_resgatadas").upsert(
    {
      aluno_id: alunoId,
      recompensa_id: recompensa.id,
      badge_id: recompensa.badge_id,
      tipo: "curso",
      matricula_criada_id: novaMatricula.id,
    },
    { onConflict: "aluno_id,recompensa_id", ignoreDuplicates: true },
  );
  if (resgateError) {
    console.error(
      `[RECOMPENSA CURSO] Erro ao registrar resgate (recompensa ${recompensa.id}, aluno ${alunoId}):`,
      resgateError,
    );
  }
}

// Chamado só com badge_id que acabaram de ser concedidos agora (ver
// concederBadges) — nunca reprocessa um badge antigo. Best-effort por
// recompensa: uma falha isolada (prêmio excluído, curso sem turma ativa)
// não deve derrubar as demais nem o badge já concedido.
async function concederRecompensasDeBadges(
  admin: Admin,
  alunoId: string,
  badgeIdsNovos: string[],
): Promise<void> {
  if (badgeIdsNovos.length === 0) return;

  const { data: recompensasData } = await admin
    .from("medalha_recompensas")
    .select("id, badge_id, tipo, premio_id, curso_id, prazo_entrega_dias")
    .in("badge_id", badgeIdsNovos);

  for (const recompensa of (recompensasData ?? []) as MedalhaRecompensa[]) {
    try {
      if (recompensa.tipo === "premio") {
        await concederRecompensaPremio(admin, alunoId, recompensa);
      } else {
        await concederRecompensaCurso(admin, alunoId, recompensa);
      }
    } catch (err) {
      // Best-effort — segue pra próxima recompensa, mas loga explicitamente
      // em vez de falhar em silêncio (senão um erro real de INSERT em
      // matriculas/pontos_eventos passa despercebido).
      console.error(`[RECOMPENSA ${recompensa.tipo.toUpperCase()}] Erro ao conceder recompensa:`, err);
    }
  }
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

  // Os 6 badges antigos (primeira_aula, modulo_completo, curso_concluido,
  // nota_maxima, presenca_exemplar, top10) são concedidos por essa function
  // SQL, chamada internamente por marcar_aula_concluida/upsert_presencas/
  // criar_tentativa_quiz/criar_tentativa_prova (ver 20260822100000). A
  // migration 20260909300000 (teto diário) recriou marcar_aula_concluida
  // sem essa chamada no final, então "primeira_aula" parou de ser
  // concedido — sem alterar a function SQL (REGRA), chama aqui pra
  // compensar, já que este ponto já roda a cada navegação do aluno e após
  // toggleAulaConcluida. Best-effort isolado: uma falha aqui não deve
  // impedir a verificação dos badges progressivos logo abaixo.
  try {
    await admin.rpc("verificar_conquistas_aluno", { p_aluno_id: alunoId });
  } catch (err) {
    console.error("[BADGES] Erro ao verificar conquistas (badges antigos):", err);
  }

  const contadores = await calcularContadores(admin, alunoId);

  const resultados = await Promise.all([
    concederBadges(admin, alunoId, contadores.ofensivaMaxima, OFENSIVA_NIVEIS),
    concederBadges(admin, alunoId, contadores.frequenciaCount, FREQUENCIA_NIVEIS),
    concederBadges(admin, alunoId, contadores.modulosConcluidos, MODULOS_NIVEIS),
    concederBadges(admin, alunoId, contadores.quizCount, QUIZ_NIVEIS),
    concederBadges(admin, alunoId, contadores.totalPontos, PONTOS_NIVEIS),
  ]);

  const badgeIdsNovos = resultados.flat();
  if (badgeIdsNovos.length > 0) {
    await concederRecompensasDeBadges(admin, alunoId, badgeIdsNovos);
  }
}

// Mesmas 5 contagens, só leitura — usado pra desenhar a barra de progresso
// das medalhas progressivas no portal do aluno (/aluno/ranking) sem
// conceder nada.
export async function getProgressoBadgesProgressivos(alunoId: string): Promise<ContadoresProgressivos> {
  const admin = createAdminClient();
  return calcularContadores(admin, alunoId);
}
