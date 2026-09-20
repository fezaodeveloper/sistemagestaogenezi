import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";

export type Ambiente = "sandbox" | "producao";

export type IntegracaoSpedy = {
  id: string;
  nome: string;
  // Já descriptografada.
  chaveApi: string;
  ambiente: Ambiente;
  cursosIds: string[];
};

type LinhaIntegracao = {
  id: string;
  nome: string;
  chave_api: string;
  ambiente: string;
  cursos_ids: string[] | null;
};

// Integrações ATIVAS, com a chave já descriptografada (uma cuja chave não puder ser
// lida — chave de criptografia trocada — é ignorada). Client ADMIN: a emissão
// automática roda em webhooks de gateway, sem sessão. Nunca lança — tabela ausente
// (migration pendente) ou erro = nenhuma integração.
export async function carregarIntegracoesAtivas(): Promise<IntegracaoSpedy[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("spedy_integracoes")
      .select("id, nome, chave_api, ambiente, cursos_ids")
      .eq("ativo", true)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    return (data as LinhaIntegracao[]).flatMap((linha) => {
      try {
        return [
          {
            id: linha.id,
            nome: linha.nome,
            chaveApi: descriptografar(linha.chave_api),
            ambiente: linha.ambiente === "producao" ? ("producao" as const) : ("sandbox" as const),
            cursosIds: linha.cursos_ids ?? [],
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

// A integração que vale pra um curso: a que lista o curso explicitamente, senão a
// "de todos os cursos" (lista vazia). O específico ganha do genérico.
export function escolherIntegracao(integracoes: IntegracaoSpedy[], cursoId: string | null | undefined): IntegracaoSpedy | null {
  if (cursoId) {
    const especifica = integracoes.find((i) => i.cursosIds.includes(cursoId));
    if (especifica) return especifica;
  }
  return integracoes.find((i) => i.cursosIds.length === 0) ?? null;
}

export async function existeIntegracaoSpedyAtiva(): Promise<boolean> {
  return (await carregarIntegracoesAtivas()).length > 0;
}
