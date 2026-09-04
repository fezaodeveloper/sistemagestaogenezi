import { z } from "zod";

export type Conversa = {
  id: string;
  aluno_id: string;
  ultima_mensagem_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MensagemChat = {
  id: string;
  conversa_id: string;
  remetente_id: string;
  texto: string;
  // Preenchidos só quando a mensagem tem um arquivo anexado (TAREFA 2B) —
  // colunas ainda não existem no banco, ver
  // supabase/migrations/20260903300000_chat_arquivos.sql (mostrada, não
  // aplicada).
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  lido_em: string | null;
  created_at: string;
};

export const mensagemFormSchema = z.object({
  texto: z
    .string({ error: "Escreva uma mensagem." })
    .trim()
    .min(1, { error: "Escreva uma mensagem." })
    .max(4000, { error: "Mensagem muito longa (máximo 4000 caracteres)." }),
});

// Mensagem com arquivo anexado pode ter texto vazio (só a legenda é
// opcional) — usada em vez de mensagemFormSchema quando há anexo.
export const mensagemComArquivoFormSchema = z.object({
  texto: z.string().trim().max(4000, { error: "Mensagem muito longa (máximo 4000 caracteres)." }),
});

export type ArquivoAnexo = { url: string; nome: string; tipo: string };
