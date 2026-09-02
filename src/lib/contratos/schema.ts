import { z } from "zod";
import type { JSONContent } from "@tiptap/react";
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";

// Um template de contrato por tipo de curso — mesmos 3 valores de
// cursos.tipo (ver src/lib/cursos/schema.ts), reaproveitado aqui em vez de
// duplicar a lista.
export const CONTRATO_TIPOS_CURSO = CURSO_TIPOS;
export type ContratoTipoCurso = (typeof CONTRATO_TIPOS_CURSO)[number];
export const CONTRATO_TIPO_CURSO_LABELS = CURSO_TIPO_LABELS;

// Variáveis disponíveis no template do contrato, substituídas na geração
// do PDF (ver src/lib/contratos/pdf.tsx) — mesmo mecanismo de
// substituição simples ({chave} -> valor) usado pelo certificado
// (src/lib/certificados/texto.ts).
export const CONTRATO_VARIAVEIS = [
  "nome_aluno",
  "cpf_aluno",
  "email_aluno",
  "telefone_aluno",
  "nome_responsavel",
  "cpf_responsavel",
  "nome_curso",
  "nome_turma",
  "turno",
  "carga_horaria",
  "data_inicio",
  "previsao_conclusao",
  "valor_total",
  "num_parcelas",
  "valor_parcela",
  "data_primeira_mensalidade",
  "forma_pagamento",
  "data_contrato",
  "nome_escola",
] as const;
export type ContratoVariavel = (typeof CONTRATO_VARIAVEIS)[number];

export const CONTRATO_VARIAVEL_LABELS: Record<ContratoVariavel, string> = {
  nome_aluno: "Nome do aluno",
  cpf_aluno: "CPF do aluno",
  email_aluno: "E-mail do aluno",
  telefone_aluno: "Telefone do aluno",
  nome_responsavel: "Nome do responsável",
  cpf_responsavel: "CPF do responsável",
  nome_curso: "Nome do curso",
  nome_turma: "Nome da turma",
  turno: "Turno",
  carga_horaria: "Carga horária",
  data_inicio: "Data de início",
  previsao_conclusao: "Previsão de conclusão",
  valor_total: "Valor total",
  num_parcelas: "Número de parcelas",
  valor_parcela: "Valor da parcela",
  data_primeira_mensalidade: "Data da 1ª mensalidade",
  forma_pagamento: "Forma de pagamento",
  data_contrato: "Data do contrato",
  nome_escola: "Nome da escola",
};

// Dados de exemplo pra prévia do template no admin (ContratoTemplateForm) —
// mesma ideia de VARIAVEIS_EXEMPLO em certificados/texto.ts.
export const VARIAVEIS_EXEMPLO_CONTRATO: Record<ContratoVariavel, string> = {
  nome_aluno: "Maria da Silva",
  cpf_aluno: "123.456.789-00",
  email_aluno: "maria@exemplo.com",
  telefone_aluno: "(11) 91234-5678",
  nome_responsavel: "João da Silva",
  cpf_responsavel: "987.654.321-00",
  nome_curso: "Curso Exemplo",
  nome_turma: "Turma A",
  turno: "Manhã",
  carga_horaria: "40 horas",
  data_inicio: "01/03/2026",
  previsao_conclusao: "01/09/2026",
  valor_total: "R$ 1.200,00",
  num_parcelas: "12",
  valor_parcela: "R$ 100,00",
  data_primeira_mensalidade: "10/03/2026",
  forma_pagamento: "Boleto bancário",
  data_contrato: "01/03/2026",
  nome_escola: "GÊNEZI Educação Profissional",
};

export type ContratoTemplate = {
  id: string;
  tipo_curso: ContratoTipoCurso;
  nome: string;
  conteudo: JSONContent;
  conteudo_texto: string | null;
  cor_texto: string;
  created_by: string;
  updated_by: string | null;
  updated_at: string;
};

export const CONTRATO_STATUSES = ["pendente", "aceito", "recusado"] as const;
export type ContratoStatus = (typeof CONTRATO_STATUSES)[number];

export type ContratoAssinado = {
  id: string;
  matricula_id: string;
  aluno_id: string;
  conteudo_pdf_base64: string | null;
  aceito_em: string | null;
  aceito_ip: string | null;
  status: ContratoStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const DOC_VAZIO: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function isJsonContent(value: unknown): value is JSONContent {
  return typeof value === "object" && value !== null;
}

// Formato exato emitido por <input type="color"> (#rrggbb minúsculo) —
// mesma regra de certificados/schema.ts.
const corHex = z
  .string({ error: "Informe uma cor válida." })
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Informe uma cor no formato #RRGGBB." });

export const contratoTemplateFormSchema = z.object({
  cor_texto: corHex,
  conteudo: z.string().transform((v, ctx) => {
    try {
      const parsed: unknown = JSON.parse(v);
      if (!isJsonContent(parsed)) throw new Error("formato inválido");
      return parsed;
    } catch {
      ctx.addIssue({ code: "custom", message: "Conteúdo do contrato inválido." });
      return DOC_VAZIO;
    }
  }),
});

export type ContratoTemplateFormValues = z.infer<typeof contratoTemplateFormSchema>;

// Extração de texto simples a partir do JSON do Tiptap — usada só pra
// preencher contrato_template.conteudo_texto (fallback declarado no
// schema da tabela), sem preservar formatação.
export function extrairTextoPlano(doc: JSONContent): string {
  const paragrafos = doc.content ?? [];
  return paragrafos
    .map((paragrafo) =>
      (paragrafo.content ?? [])
        .filter((no) => no.type === "text")
        .map((no) => no.text ?? "")
        .join(""),
    )
    .join("\n");
}

function paragrafo(texto: string, opcoes?: { negrito?: boolean }): JSONContent {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: texto,
        ...(opcoes?.negrito ? { marks: [{ type: "bold" }] } : {}),
      },
    ],
  };
}

// Texto padrão do contrato — usado quando o admin ainda não personalizou
// o template (ver src/app/admin/contrato/page.tsx). Variáveis substituídas
// na geração do PDF (ver CONTRATO_VARIAVEIS acima).
export function criarConteudoPadrao(): JSONContent {
  return {
    type: "doc",
    content: [
      paragrafo("1. PARTES CONTRATANTES", { negrito: true }),
      paragrafo("CONTRATANTE: {nome_escola}, doravante denominada CONTRATANTE."),
      paragrafo(
        "CONTRATADO(A): {nome_aluno}, portador(a) do CPF {cpf_aluno}, e-mail {email_aluno}, telefone {telefone_aluno}, doravante denominado(a) ALUNO(A).",
      ),
      paragrafo(
        "RESPONSÁVEL LEGAL (quando o(a) aluno(a) for menor de idade): {nome_responsavel}, portador(a) do CPF {cpf_responsavel}.",
      ),
      paragrafo("2. OBJETO DO CONTRATO", { negrito: true }),
      paragrafo(
        "O presente contrato tem por objeto a prestação de serviços educacionais referentes ao curso {nome_curso}, ministrado na turma {nome_turma}, turno {turno}, com carga horária total de {carga_horaria}.",
      ),
      paragrafo(
        "O curso terá início em {data_inicio}, com previsão de conclusão em {previsao_conclusao}.",
      ),
      paragrafo("3. VALOR E FORMA DE PAGAMENTO", { negrito: true }),
      paragrafo(
        "O valor total dos serviços educacionais é de {valor_total}, a ser pago em {num_parcelas} parcela(s) de {valor_parcela}, com vencimento da primeira parcela em {data_primeira_mensalidade}.",
      ),
      paragrafo("A forma de pagamento acordada entre as partes é: {forma_pagamento}."),
      paragrafo("4. OBRIGAÇÕES DA ESCOLA", { negrito: true }),
      paragrafo(
        "A CONTRATANTE se compromete a ministrar o curso contratado com qualidade, disponibilizar corpo docente qualificado, material didático necessário e infraestrutura adequada ao bom andamento das aulas.",
      ),
      paragrafo("5. OBRIGAÇÕES DO ALUNO", { negrito: true }),
      paragrafo(
        "O(A) ALUNO(A) se compromete a frequentar as aulas, cumprir os prazos e atividades exigidos pelo curso, zelar pelo patrimônio da escola e efetuar o pagamento das parcelas nas datas acordadas.",
      ),
      paragrafo("6. RESCISÃO", { negrito: true }),
      paragrafo(
        "O presente contrato poderá ser rescindido a qualquer momento por qualquer das partes, mediante comunicação por escrito, observadas as condições de reembolso e multa previstas na política comercial vigente da escola.",
      ),
      paragrafo("7. DISPOSIÇÕES GERAIS", { negrito: true }),
      paragrafo(
        "As partes elegem o foro da comarca da escola para dirimir quaisquer dúvidas ou litígios decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.",
      ),
      paragrafo("E, por estarem assim justas e contratadas, firmam o presente instrumento em {data_contrato}."),
    ],
  };
}
