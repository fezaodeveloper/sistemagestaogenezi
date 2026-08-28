import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

export const CERTIFICADO_STATUS = ["pendente_emissao", "emitido"] as const;
export type CertificadoStatus = (typeof CERTIFICADO_STATUS)[number];

export const LOGO_POSICOES = [
  "topo_centro",
  "superior_esquerdo",
  "superior_direito",
  "sem_logo",
] as const;
export type LogoPosicao = (typeof LOGO_POSICOES)[number];

export const LOGO_POSICAO_LABELS: Record<LogoPosicao, string> = {
  topo_centro: "Topo centralizado",
  superior_esquerdo: "Canto superior esquerdo",
  superior_direito: "Canto superior direito",
  sem_logo: "Sem logo (já está na imagem de fundo)",
};

export const LOGO_TAMANHOS = ["pequeno", "medio", "grande"] as const;
export type LogoTamanho = (typeof LOGO_TAMANHOS)[number];

export const LOGO_TAMANHO_LABELS: Record<LogoTamanho, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

// Margens da caixa de texto, em % da página (mesma unidade pros dois
// lados, resolução-independente — não depende do tamanho em px da
// imagem de fundo que o admin subir).
export type MargensTexto = {
  superior: number;
  inferior: number;
  esquerda: number;
  direita: number;
};

export type CertificadoTemplate = {
  id: boolean;
  fundo_frente_url: string | null;
  fundo_verso_url: string | null;
  logo_url: string | null;
  logo_posicao: LogoPosicao;
  logo_tamanho: LogoTamanho;
  texto_frente: JSONContent;
  texto_verso: JSONContent;
  texto_frente_margens: MargensTexto;
  texto_verso_margens: MargensTexto;
  cor_texto_frente: string;
  cor_texto_verso: string;
  assinatura_url: string | null;
  assinatura_x_percentual: number;
  assinatura_y_percentual: number;
  assinatura_largura_px: number;
  cidade_emissao: string | null;
  estado_emissao: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type Certificado = {
  id: string;
  matricula_id: string;
  status: CertificadoStatus;
  liberado: boolean;
  nota_minima_obtida_percentual: number | null;
  aproveitamento_percentual: number | null;
  frequencia_percentual: number | null;
  carga_horaria_horas: number | null;
  arquivo_url: string | null;
  emitido_em: string | null;
  emitido_por: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Documento Tiptap vazio, aceito como "sem conteúdo digitado ainda" —
// mesma forma que o editor produz ao ser esvaziado.
const DOC_VAZIO: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function isJsonContent(value: unknown): value is JSONContent {
  return typeof value === "object" && value !== null;
}

// Formato exato emitido por <input type="color"> (#rrggbb minúsculo) —
// não precisa aceitar variações (#fff, rgb(...), nomes de cor), já que o
// valor sempre vem desse input, nunca digitado à mão.
const corHex = z
  .string({ error: "Informe uma cor válida." })
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Informe uma cor no formato #RRGGBB." });

const percentual0a100 = z.coerce
  .number({ error: "Informe um número entre 0 e 100." })
  .int({ error: "Informe um número inteiro." })
  .min(0, { error: "Mínimo 0." })
  .max(100, { error: "Máximo 100." });

export const templateFormSchema = z.object({
  logo_posicao: z.enum(LOGO_POSICOES, { error: "Selecione a posição do logo." }),
  logo_tamanho: z.enum(LOGO_TAMANHOS, { error: "Selecione o tamanho do logo." }),
  cidade_emissao: z.string().trim().max(120).optional(),
  estado_emissao: z.string().trim().max(120).optional(),
  texto_frente_margem_superior: percentual0a100,
  texto_frente_margem_inferior: percentual0a100,
  texto_frente_margem_esquerda: percentual0a100,
  texto_frente_margem_direita: percentual0a100,
  texto_verso_margem_superior: percentual0a100,
  texto_verso_margem_inferior: percentual0a100,
  texto_verso_margem_esquerda: percentual0a100,
  texto_verso_margem_direita: percentual0a100,
  cor_texto_frente: corHex,
  cor_texto_verso: corHex,
  assinatura_x_percentual: percentual0a100,
  assinatura_y_percentual: percentual0a100,
  assinatura_largura_px: z.coerce
    .number({ error: "Informe um número." })
    .int({ error: "Informe um número inteiro." })
    .positive({ error: "Deve ser maior que zero." }),
  texto_frente: z
    .string()
    .transform((v, ctx) => {
      try {
        const parsed: unknown = JSON.parse(v);
        if (!isJsonContent(parsed)) throw new Error("formato inválido");
        return parsed;
      } catch {
        ctx.addIssue({ code: "custom", message: "Texto da frente inválido." });
        return DOC_VAZIO;
      }
    }),
  texto_verso: z
    .string()
    .transform((v, ctx) => {
      try {
        const parsed: unknown = JSON.parse(v);
        if (!isJsonContent(parsed)) throw new Error("formato inválido");
        return parsed;
      } catch {
        ctx.addIssue({ code: "custom", message: "Texto do verso inválido." });
        return DOC_VAZIO;
      }
    }),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;
