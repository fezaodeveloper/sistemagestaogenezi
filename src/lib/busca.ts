// Utilitários de busca compartilhados pelas listagens com paginação. A busca
// roda no SERVIDOR (parâmetro `q` da URL) pra valer sobre todos os registros,
// não só a página carregada — ver useBuscaUrl (src/hooks/use-busca-url.ts).

// Minúsculas e sem acento: "jose" encontra "José", "sao" encontra "São".
export function normalizarBusca(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function parseBusca(valor: string | undefined): string {
  return (valor ?? "").trim().slice(0, 100);
}

// Só dígitos — pra buscar CPF/telefone ignorando máscara.
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

// Termo seguro pra ilike: % e _ são curingas e \ é o escape do Postgres, e
// vírgula/parênteses quebram a sintaxe de .or() do PostgREST.
export function termoIlike(valor: string): string {
  return valor
    .trim()
    .replace(/[\\%_]/g, (caractere) => `\\${caractere}`)
    .replace(/[,()]/g, " ");
}
