// Tipos e helpers compartilhados pela exclusão em lote das listagens do admin
// (alunos, leads, matrículas, agendamentos). Fica fora dos arquivos
// "use server": ali só podem ser exportadas Server Actions.

// Teto por requisição — cada exclusão pode envolver várias operações (Auth,
// cascatas, cancelamento no Asaas), então não se aceita uma lista ilimitada.
export const LIMITE_EXCLUSAO_EM_LOTE = 200;

export type ResultadoExclusaoLote = {
  excluidos: number;
  // ids que NÃO puderam ser excluídos (a tela mantém esses itens selecionados).
  falhas: string[];
  // Erro que impediu a operação inteira (ex.: lista inválida).
  erro?: string;
  // Informação extra sobre o que foi feito (ex.: parcelas excluídas junto).
  aviso?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida o que veio do client (uma Server Action é alcançável por POST direto):
// só uuids, sem repetição, dentro do limite. null = lista inválida.
export function sanitizarIdsLote(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  const unicos = [...new Set(ids.filter((id): id is string => typeof id === "string" && UUID.test(id)))];
  if (unicos.length === 0 || unicos.length > LIMITE_EXCLUSAO_EM_LOTE) return null;
  return unicos;
}

export const ERRO_LOTE_INVALIDO = `Seleção inválida. Selecione entre 1 e ${LIMITE_EXCLUSAO_EM_LOTE} itens.`;

// Mensagem mostrada na tela depois da exclusão em lote.
export function descreverResultadoLote(resultado: ResultadoExclusaoLote): string {
  if (resultado.erro) return resultado.erro;
  const partes: string[] = [];
  if (resultado.excluidos > 0) {
    partes.push(`${resultado.excluidos} item(s) excluído(s).`);
  }
  if (resultado.falhas.length > 0) {
    partes.push(
      `${resultado.falhas.length} item(s) não puderam ser excluídos e continuam selecionados — tente novamente ou exclua individualmente.`,
    );
  }
  if (resultado.aviso) partes.push(resultado.aviso);
  return partes.join(" ");
}
