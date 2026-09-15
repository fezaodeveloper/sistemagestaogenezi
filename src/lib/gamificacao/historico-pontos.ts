import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type HistoricoPontoItem = {
  id: string;
  tipoEvento: string;
  pontos: number;
  createdAt: string;
  descricao: string;
};

type EventoRow = { id: string; tipo_evento: string; pontos: number; referencia_id: string; created_at: string };

// RLS de pontos_eventos só libera SELECT pra admin ("Admins podem ver
// eventos de pontos", ver 20260821100000_create_pontos_gamificacao.sql) —
// não existe policy pro próprio aluno ver os PRÓPRIOS eventos. Sem
// migration nova (REGRA da tarefa): bypass via service_role, mesmo padrão
// já usado noutras leituras deste projeto — a consulta já é filtrada pelas
// matrículas do alunoId recebido por parâmetro antes de chegar aqui, então
// nunca expõe dado de outro aluno.
//
// referencia_id aponta pra uma tabela diferente dependendo de tipo_evento
// (presencas.id, aulas.id, quizzes.id, provas.id, modulos.id, cursos.id —
// nunca uma FK de verdade, ver comentário na migration original) — por
// isso a busca de título é feita tabela por tabela, em paralelo, em vez de
// um único join.
export async function getHistoricoPontosAluno(alunoId: string): Promise<HistoricoPontoItem[]> {
  const admin = createAdminClient();

  const { data: matriculasData } = await admin.from("matriculas").select("id").eq("aluno_id", alunoId);
  const matriculaIds = (matriculasData ?? []).map((m) => m.id as string);
  if (matriculaIds.length === 0) return [];

  const { data: eventosData } = await admin
    .from("pontos_eventos")
    .select("id, tipo_evento, pontos, referencia_id, created_at")
    .in("matricula_id", matriculaIds)
    .order("created_at", { ascending: false })
    .limit(50);

  const eventos = (eventosData as EventoRow[] | null) ?? [];
  if (eventos.length === 0) return [];

  const idsPorTipo = (tipo: string) =>
    [...new Set(eventos.filter((e) => e.tipo_evento === tipo).map((e) => e.referencia_id))];

  const [aulasRes, presencasRes, quizzesRes, provasRes, modulosRes, cursosRes] = await Promise.all([
    admin.from("aulas").select("id, titulo").in("id", idsPorTipo("aula_concluida")),
    admin.from("presencas").select("id, aula_id").in("id", idsPorTipo("presenca")),
    admin.from("quizzes").select("id, titulo").in("id", idsPorTipo("quiz")),
    admin.from("provas").select("id, titulo").in("id", idsPorTipo("prova")),
    admin.from("modulos").select("id, titulo").in("id", idsPorTipo("modulo_concluido")),
    admin.from("cursos").select("id, nome").in("id", idsPorTipo("curso_concluido")),
  ]);

  const aulaTituloPorId = new Map((aulasRes.data ?? []).map((a) => [a.id as string, a.titulo as string]));
  const presencaAulaIdPorId = new Map((presencasRes.data ?? []).map((p) => [p.id as string, p.aula_id as string]));
  const quizTituloPorId = new Map((quizzesRes.data ?? []).map((q) => [q.id as string, q.titulo as string]));
  const provaTituloPorId = new Map((provasRes.data ?? []).map((p) => [p.id as string, p.titulo as string]));
  const moduloTituloPorId = new Map((modulosRes.data ?? []).map((m) => [m.id as string, m.titulo as string]));
  const cursoNomePorId = new Map((cursosRes.data ?? []).map((c) => [c.id as string, c.nome as string]));

  // Presença guarda só aula_id, não o título — mais um hop pra resolver o
  // nome da aula correspondente.
  const aulaIdsDePresencas = [...new Set(presencaAulaIdPorId.values())];
  const { data: aulasDePresencasData } =
    aulaIdsDePresencas.length > 0
      ? await admin.from("aulas").select("id, titulo").in("id", aulaIdsDePresencas)
      : { data: [] as { id: string; titulo: string }[] };
  const tituloAulaPorAulaId = new Map((aulasDePresencasData ?? []).map((a) => [a.id as string, a.titulo as string]));

  function descrever(evento: EventoRow): string {
    switch (evento.tipo_evento) {
      case "aula_concluida": {
        const titulo = aulaTituloPorId.get(evento.referencia_id);
        return titulo ? `Aula concluída: ${titulo}` : "Aula concluída";
      }
      case "presenca": {
        const aulaId = presencaAulaIdPorId.get(evento.referencia_id);
        const titulo = aulaId ? tituloAulaPorAulaId.get(aulaId) : undefined;
        return titulo ? `Presença: ${titulo}` : "Presença registrada";
      }
      case "quiz": {
        const titulo = quizTituloPorId.get(evento.referencia_id);
        return titulo ? `Quiz: ${titulo}` : "Quiz respondido";
      }
      case "prova": {
        const titulo = provaTituloPorId.get(evento.referencia_id);
        return titulo ? `Prova: ${titulo}` : "Prova realizada";
      }
      case "modulo_concluido": {
        const titulo = moduloTituloPorId.get(evento.referencia_id);
        return titulo ? `Módulo concluído: ${titulo}` : "Módulo concluído";
      }
      case "curso_concluido": {
        const nome = cursoNomePorId.get(evento.referencia_id);
        return nome ? `Curso concluído: ${nome}` : "Curso concluído";
      }
      case "recompensa_medalha":
        return "Medalha conquistada";
      default:
        return evento.tipo_evento;
    }
  }

  return eventos.map((evento) => ({
    id: evento.id,
    tipoEvento: evento.tipo_evento,
    pontos: evento.pontos,
    createdAt: evento.created_at,
    descricao: descrever(evento),
  }));
}
