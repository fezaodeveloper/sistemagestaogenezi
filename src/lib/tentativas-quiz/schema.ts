export type TentativaQuiz = {
  id: string;
  quiz_id: string;
  matricula_id: string;
  numero: number;
  nota: number;
  aprovado: boolean;
  created_by: string;
  created_at: string;
};

export type RespostaQuiz = {
  id: string;
  tentativa_id: string;
  questao_id: string;
  alternativa_id: string | null;
  resposta_texto: string | null;
  correta: boolean | null;
  created_by: string;
  created_at: string;
};
