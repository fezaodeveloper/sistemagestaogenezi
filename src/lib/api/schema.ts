export const API_PERMISSOES = [
  "alunos",
  "matriculas",
  "financeiro",
  "leads",
  "presencas",
  "eventos",
] as const;
export type ApiPermissao = (typeof API_PERMISSOES)[number];

export const API_PERMISSAO_LABELS: Record<ApiPermissao, string> = {
  alunos: "Alunos",
  matriculas: "Matrículas",
  financeiro: "Financeiro",
  leads: "Leads",
  presencas: "Presenças",
  eventos: "Eventos",
};

export type ApiKey = {
  id: string;
  nome: string;
  chave: string;
  permissoes: ApiPermissao[];
  ativa: boolean;
  ultimo_uso: string | null;
  total_requisicoes: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
