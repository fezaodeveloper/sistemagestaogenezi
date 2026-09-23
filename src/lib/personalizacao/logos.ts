import "server-only";

import { cache } from "react";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type LogosEscola = {
  claro: string | null;
  escuro: string | null;
  colapsadaClaro: string | null;
  colapsadaEscuro: string | null;
};

const SEM_LOGOS: LogosEscola = { claro: null, escuro: null, colapsadaClaro: null, colapsadaEscuro: null };

// Logos da escola pras sidebars de admin E aluno (sessão autenticada). Resiliente: se a
// migration de personalização ainda não foi aplicada as 3 colunas novas não existem e a consulta
// completa falha — tenta só a logo original antes de desistir. Nunca lança.
//
// cache() do React: o layout do aluno (sidebar) e a página da aula (logo no canto do player)
// chamam isso de forma independente na mesma request — sem cache() seria uma query duplicada
// (mesmo padrão de getRecursosHabilitadosAluno, ver src/lib/configuracoes/recursos.ts).
export const getLogosEscola = cache(async (supabase: SupabaseServerClient): Promise<LogosEscola> => {
  try {
    const completa = await supabase
      .from("configuracoes")
      .select("escola_logo_url, escola_logo_escuro_url, escola_logo_colapsada_url, escola_logo_colapsada_escuro_url")
      .eq("id", true)
      .maybeSingle();

    if (!completa.error && completa.data) {
      return {
        claro: completa.data.escola_logo_url ?? null,
        escuro: completa.data.escola_logo_escuro_url ?? null,
        colapsadaClaro: completa.data.escola_logo_colapsada_url ?? null,
        colapsadaEscuro: completa.data.escola_logo_colapsada_escuro_url ?? null,
      };
    }

    const basica = await supabase.from("configuracoes").select("escola_logo_url").eq("id", true).maybeSingle();
    return { ...SEM_LOGOS, claro: basica.data?.escola_logo_url ?? null };
  } catch {
    return SEM_LOGOS;
  }
});

// Escolhe a logo para o tema: "logo tema escuro" é a versão feita para fundo escuro. No tema escuro
// usa ela e, se o admin não cadastrou, cai na logo do tema claro; no tema claro usa sempre a clara.
export function escolherLogo(claro: string | null, escuro: string | null, tema: "claro" | "escuro"): string | null {
  return tema === "escuro" ? (escuro ?? claro) : claro;
}
