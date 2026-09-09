import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Registra 1 linha de histórico por campo alterado — só grava se o valor
// realmente mudou (comparação de string; quem chama já converte pra string
// antes). Via client admin: historico_alteracoes não tem grant de insert
// pra authenticated (só select, ver migration), então uma alteração feita
// pelo client normal do admin não conseguiria gravar aqui.
// Best-effort: nunca lança — perder uma linha de histórico não deve
// impedir a alteração principal (já feita com sucesso antes de chamar isto).
export async function registrarAlteracao(params: {
  tabela: "alunos" | "matriculas";
  registroId: string;
  campo: string;
  valorAnterior: string | null | undefined;
  valorNovo: string | null | undefined;
  alteradoPor: string;
}): Promise<void> {
  const valorAnterior = params.valorAnterior ?? null;
  const valorNovo = params.valorNovo ?? null;
  if (valorAnterior === valorNovo) return;

  try {
    const admin = createAdminClient();
    await admin.from("historico_alteracoes").insert({
      tabela: params.tabela,
      registro_id: params.registroId,
      campo: params.campo,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      alterado_por: params.alteradoPor,
    });
  } catch {
    // Best-effort — ver comentário acima.
  }
}
