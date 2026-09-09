import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CURSO_TIPOS } from "@/lib/cursos/schema";

export type RecursosHabilitados = {
  gamificacao: boolean;
  premios: boolean;
  ranking: boolean;
  chat: boolean;
  certificados: boolean;
};

const RECURSOS_PADRAO: RecursosHabilitados = {
  gamificacao: true,
  premios: true,
  ranking: true,
  chat: true,
  certificados: true,
};

type MatriculaTipoRow = {
  status: string;
  turmas: { cursos: { tipo: (typeof CURSO_TIPOS)[number] } | null } | null;
};

// cache() por request (mesmo padrão de getCurrentProfile em lib/auth/dal.ts)
// — o layout do aluno e cada página (ranking, créditos, sidebar) chamam
// isso de forma independente, já que um Server Component filho não recebe
// props/contexto injetados pelo layout pai; o cache garante uma única query
// por requisição em vez de recalcular em cada chamada.
export const getRecursosHabilitadosAluno = cache(
  async (alunoId: string): Promise<RecursosHabilitados> => {
    const supabase = await createClient();

    const [{ data: matriculasData }, { data: config }] = await Promise.all([
      supabase
        .from("matriculas")
        .select("status, turmas(cursos(tipo))")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false }),
      supabase
        .from("configuracoes")
        .select(
          "recurso_gamificacao_presencial, recurso_gamificacao_ead, recurso_gamificacao_hibrido, recurso_premios_presencial, recurso_premios_ead, recurso_premios_hibrido, recurso_ranking_presencial, recurso_ranking_ead, recurso_ranking_hibrido, recurso_chat_presencial, recurso_chat_ead, recurso_chat_hibrido, recurso_certificados_presencial, recurso_certificados_ead, recurso_certificados_hibrido",
        )
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (!config) return RECURSOS_PADRAO;

    // Curso principal: a matrícula ativa mais recente; sem nenhuma ativa,
    // a mais recente de qualquer status (linhas já vêm ordenadas por
    // created_at desc).
    const matriculas = (matriculasData ?? []) as unknown as MatriculaTipoRow[];
    const principal = matriculas.find((m) => m.status === "ativa") ?? matriculas[0];
    const tipo = principal?.turmas?.cursos?.tipo ?? "presencial";

    if (tipo === "ead") {
      return {
        gamificacao: config.recurso_gamificacao_ead ?? true,
        premios: config.recurso_premios_ead ?? true,
        ranking: config.recurso_ranking_ead ?? true,
        chat: config.recurso_chat_ead ?? true,
        certificados: config.recurso_certificados_ead ?? true,
      };
    }

    if (tipo === "hibrido") {
      return {
        gamificacao: config.recurso_gamificacao_hibrido ?? true,
        premios: config.recurso_premios_hibrido ?? true,
        ranking: config.recurso_ranking_hibrido ?? true,
        chat: config.recurso_chat_hibrido ?? true,
        certificados: config.recurso_certificados_hibrido ?? true,
      };
    }

    return {
      gamificacao: config.recurso_gamificacao_presencial ?? true,
      premios: config.recurso_premios_presencial ?? true,
      ranking: config.recurso_ranking_presencial ?? true,
      chat: config.recurso_chat_presencial ?? true,
      certificados: config.recurso_certificados_presencial ?? true,
    };
  },
);
