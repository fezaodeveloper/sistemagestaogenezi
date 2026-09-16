import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Chave global que liga/desliga o Gênezi Conecta pra alunos e candidatos
// externos (TAREFA 6 do roadmap). Default true quando a coluna ainda não
// existir ou a query falhar — nunca esconde o portal por causa de um erro
// transitório. Usada tanto no layout/página do aluno (client autenticado
// normal) quanto no proxy, que faz sua própria checagem com o client admin
// (ver src/proxy.ts) por rodar antes de qualquer sessão.
export async function getConectaHabilitado(supabase: SupabaseServerClient): Promise<boolean> {
  const { data } = await supabase
    .from("configuracoes")
    .select("conecta_habilitado")
    .eq("id", true)
    .maybeSingle();

  return data?.conecta_habilitado ?? true;
}
