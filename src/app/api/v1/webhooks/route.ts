import "server-only";

import { autenticarApiKey, respostaErro } from "@/lib/api/auth";

// POST /api/v1/webhooks/registrar — estrutura pronta pra quando o cadastro
// de webhooks de saída for implementado de verdade (ver
// src/lib/api/webhooks-saida.ts). Hoje só valida a API Key e o formato do
// body, sem persistir nada.
export async function POST(request: Request) {
  const auth = await autenticarApiKey(request);
  if (!auth) return respostaErro("API Key inválida ou inativa.", 401);

  const body = (await request.json().catch(() => null)) as { url?: string; eventos?: string[] } | null;
  if (!body?.url || !Array.isArray(body.eventos)) {
    return respostaErro("Body inválido — esperado { url: string, eventos: string[] }.", 400);
  }

  return Response.json({ message: "Webhooks de saída em breve disponíveis." });
}
