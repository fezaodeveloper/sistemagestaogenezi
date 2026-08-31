// Parsing/cálculo de paginação server-side compartilhado entre páginas de
// listagem (alunos, matrículas) — mesma lógica, evita duplicar em cada
// page.tsx.

export const LIMITE_PADRAO = 20;
export const LIMITES_VALIDOS = [20, 50, 100] as const;

export function parsePagina(valor: string | undefined): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

export function parseLimite(valor: string | undefined): number {
  const numero = Number(valor);
  return (LIMITES_VALIDOS as readonly number[]).includes(numero) ? numero : LIMITE_PADRAO;
}

export function calcularOffset(pagina: number, limite: number): number {
  return (pagina - 1) * limite;
}

export function calcularTotalPaginas(totalRegistros: number, limite: number): number {
  return Math.max(1, Math.ceil(totalRegistros / limite));
}
