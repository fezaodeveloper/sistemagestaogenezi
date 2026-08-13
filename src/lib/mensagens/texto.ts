// Normaliza pro formato que a Evolution API espera: só dígitos, com DDI 55
// na frente. alunos.telefone não tem validação de formato (CLAUDE.md) —
// aceita como o admin digitou (com máscara, espaços, parênteses etc.).
// DDD "55" não existe no Brasil (é reservado ao DDI), então não há
// ambiguidade entre "já tem DDI" e "DDD 55 sem DDI".
export function normalizarTelefone(telefoneBruto: string): string | null {
  const digitos = telefoneBruto.replace(/\D/g, "");

  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return digitos;
  }
  return null;
}
