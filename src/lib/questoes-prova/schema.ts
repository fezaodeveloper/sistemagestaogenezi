import type { QUESTAO_TIPOS } from "@/lib/questoes/schema";

export type QuestaoProva = {
  id: string;
  prova_id: string;
  tipo: (typeof QUESTAO_TIPOS)[number];
  enunciado: string;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AlternativaProva = {
  id: string;
  questao_prova_id: string;
  texto: string;
  correta: boolean;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type QuestaoProvaWithAlternativas = QuestaoProva & { alternativas: AlternativaProva[] };
