export const TERMO_LEGAL_CHAVES_ALUNO = ["privacidade", "termos", "lgpd", "imagem"] as const;

// Gênezi Conecta reusa a MESMA tabela termos_legais (prefixo "conecta_", REGRA da tarefa) —
// evita inventar uma segunda estrutura só porque o público (candidatos/empresas) é diferente do
// portal do aluno. conecta_menor_termo é o texto do checkbox de acompanhamento exibido a
// candidatos/alunos de 16-17 anos (ver cadastro-externo-form.tsx e conecta-perfil-form.tsx).
export const TERMO_LEGAL_CHAVES_CONECTA = [
  "conecta_termos_uso",
  "conecta_privacidade",
  "conecta_cookies",
  "conecta_lgpd",
  "conecta_menor_termo",
] as const;

export const TERMO_LEGAL_CHAVES = [...TERMO_LEGAL_CHAVES_ALUNO, ...TERMO_LEGAL_CHAVES_CONECTA] as const;
export type TermoLegalChave = (typeof TERMO_LEGAL_CHAVES)[number];

// Caminho público de cada documento — usado tanto pro link "Visualizar" no editor admin quanto
// pro revalidatePath depois de salvar (ver src/app/admin/legal/actions.ts). conecta_menor_termo
// não tem página própria (é um trecho dentro de duas telas, não uma página legal completa) —
// aponta pro cadastro externo, que é onde o texto aparece pra um visitante sem sessão.
export const TERMO_LEGAL_CAMINHO_PUBLICO: Record<TermoLegalChave, string> = {
  privacidade: "/aluno/legal/privacidade",
  termos: "/aluno/legal/termos",
  lgpd: "/aluno/legal/lgpd",
  imagem: "/aluno/legal/imagem",
  conecta_termos_uso: "/conecta/termos-de-uso",
  conecta_privacidade: "/conecta/privacidade",
  conecta_cookies: "/conecta/cookies",
  conecta_lgpd: "/conecta/lgpd",
  conecta_menor_termo: "/conecta/cadastro",
};

export type TermoLegal = {
  id: string;
  chave: TermoLegalChave;
  titulo: string;
  conteudo: string;
  atualizado_em: string;
  atualizado_por: string | null;
};
