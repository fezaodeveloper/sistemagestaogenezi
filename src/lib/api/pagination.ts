import "server-only";

const LIMIT_PADRAO = 50;
const LIMIT_MAXIMO = 200;

// Parsing compartilhado de limit/offset por todos os endpoints de listagem
// da API pública (/api/v1/*) — valores inválidos (não numéricos, negativos)
// caem no padrão em vez de gerar erro 400, mantendo a API tolerante a
// integrações mal configuradas.
export function parsePaginacao(url: URL): { limit: number; offset: number } {
  const limitParam = Number(url.searchParams.get("limit"));
  const offsetParam = Number(url.searchParams.get("offset"));

  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, LIMIT_MAXIMO) : LIMIT_PADRAO;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  return { limit, offset };
}
