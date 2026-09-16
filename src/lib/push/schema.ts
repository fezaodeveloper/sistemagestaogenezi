import { z } from "zod";

export const notificacaoPushSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título.").max(50, "O título pode ter no máximo 50 caracteres."),
  corpo: z
    .string()
    .trim()
    .min(1, "Informe o corpo da mensagem.")
    .max(150, "O corpo pode ter no máximo 150 caracteres."),
  url: z.string().trim().min(1, "Informe a URL de destino."),
});
