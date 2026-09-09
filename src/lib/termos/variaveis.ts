// Variáveis disponíveis nos termos — mais simples que contratos (ver
// CONTRATO_VARIAVEIS em lib/contratos/schema.ts): não há dados de
// matrícula/curso/turma aqui, só identificação do aluno e da escola. Mesmo
// mecanismo de substituição ({chave} -> valor), resolvido na geração do PDF
// (ver lib/termos/pdf.tsx).
export const TERMO_VARIAVEIS = [
  "nome_aluno",
  "cpf_aluno",
  "email_aluno",
  "data_aceite",
  "nome_escola",
  "data_termo",
] as const;
export type TermoVariavel = (typeof TERMO_VARIAVEIS)[number];

export const TERMO_VARIAVEL_LABELS: Record<TermoVariavel, string> = {
  nome_aluno: "Nome do aluno",
  cpf_aluno: "CPF do aluno",
  email_aluno: "E-mail do aluno",
  data_aceite: "Data do aceite",
  nome_escola: "Nome da escola",
  data_termo: "Data de hoje",
};

// Dados de exemplo pra prévia do editor (TermoEditorForm) — mesma ideia de
// VARIAVEIS_EXEMPLO_CONTRATO em contratos/schema.ts.
export const VARIAVEIS_EXEMPLO_TERMO: Record<TermoVariavel, string> = {
  nome_aluno: "Maria da Silva",
  cpf_aluno: "123.456.789-00",
  email_aluno: "maria@exemplo.com",
  data_aceite: "01/03/2026",
  nome_escola: "GÊNEZI Educação Profissional",
  data_termo: "01/03/2026",
};
