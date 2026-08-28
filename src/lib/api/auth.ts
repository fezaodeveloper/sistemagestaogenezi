import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ApiAuthResult = { valida: boolean; permissoes: string[]; keyId: string };

// Autenticação da API pública (/api/v1/*) via header X-API-Key — nunca a
// sessão do usuário logado, essa API é pensada pra ser chamada por
// serviços externos (N8n, Zapier, etc.), não pelo browser do admin.
export async function autenticarApiKey(request: Request): Promise<ApiAuthResult | null> {
  const chave = request.headers.get("x-api-key");
  if (!chave) return null;

  const admin = createAdminClient();
  const { data: apiKey } = await admin
    .from("api_keys")
    .select("id, permissoes, total_requisicoes")
    .eq("chave", chave)
    .eq("ativa", true)
    .maybeSingle();

  if (!apiKey) return null;

  // Best-effort: contabilização de uso não deve derrubar a requisição se
  // falhar por qualquer motivo.
  try {
    await admin
      .from("api_keys")
      .update({
        ultimo_uso: new Date().toISOString(),
        total_requisicoes: (apiKey.total_requisicoes ?? 0) + 1,
      })
      .eq("id", apiKey.id);
  } catch {
    // Ignorado de propósito — ver comentário acima.
  }

  return {
    valida: true,
    permissoes: (apiKey.permissoes as string[] | null) ?? [],
    keyId: apiKey.id,
  };
}

export function respostaErro(mensagem: string, status: number): Response {
  return Response.json({ error: mensagem }, { status });
}

export function respostaSucesso(data: unknown): Response {
  return Response.json({ data, timestamp: new Date().toISOString() }, { status: 200 });
}
