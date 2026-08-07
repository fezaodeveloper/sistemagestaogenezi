export type TentativaProva = {
  id: string;
  prova_id: string;
  matricula_id: string;
  numero: number;
  nota: number;
  aprovado: boolean;
  created_by: string;
  created_at: string;
};

export type RespostaProva = {
  id: string;
  tentativa_id: string;
  questao_prova_id: string;
  alternativa_prova_id: string | null;
  resposta_texto: string | null;
  correta: boolean | null;
  created_by: string;
  created_at: string;
};
