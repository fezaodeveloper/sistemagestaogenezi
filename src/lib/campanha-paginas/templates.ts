// TAREFA campanha 2.5 (PARTE 1) — galeria de templates prontos pra "Nova página de campanha".
//
// IMPORTANTE (premissa corrigida — ver resumo da tarefa): `campanha_paginas` NÃO tem uma coluna
// `blocos` jsonb nem um "page builder" de blocos (Hero/Texto/Lista/CTA/Rodapé) — a página pública
// é um FUNIL DE CAPTAÇÃO de várias etapas (título/subtítulo/descrição + cards de destaque +
// etapas de perguntas + contador regressivo + tela de sucesso), sempre terminando no MESMO
// formulário inline de nome/WhatsApp/idade (nunca um botão com link externo). Os 4 templates
// abaixo usam esses campos reais, não blocos — "CTA texto/link" do pedido original não existe
// como campo próprio (o "CTA" é sempre o botão de envio do formulário).

import type { CampanhaPaginaStatus, CampanhaTema, CardDestaque, Etapa } from "./schema";

export const CAMPANHA_TEMPLATE_IDS = ["matricula_aberta", "evento_workshop", "promocao_desconto", "pagina_obrigado"] as const;
export type CampanhaTemplateId = (typeof CAMPANHA_TEMPLATE_IDS)[number];

// Campos que o template pré-define — os mesmos que criarCampanhaPagina já grava, só que vindos
// de um preset em vez do formulário completo do editor.
export type CampanhaTemplateCampos = {
  titulo: string;
  subtitulo: string;
  descricao: string;
  cor_primaria: string;
  cor_fundo: string;
  cor_fonte: string;
  tema: CampanhaTema;
  status: CampanhaPaginaStatus;
  mostrar_contador: boolean;
  contador_data_fim: string | null;
  coletar_email: boolean;
  coletar_cidade: boolean;
  cards_destaque: CardDestaque[];
  etapas: Etapa[];
  titulo_sucesso: string;
  mensagem_sucesso: string;
};

export type CampanhaTemplateDefinicao = {
  id: CampanhaTemplateId;
  nome: string;
  descricao: string;
  // Preview simplificado (div estilizada, não screenshot) — ver CampanhaTemplatePreview.
  corDestaque: string;
  // Campos que a modal de personalização rápida mostra pra este template.
  pedeCurso: boolean;
  pedeDataLimite: boolean;
  gerar: (dados: { titulo: string; subtitulo: string; dataLimite?: string }) => CampanhaTemplateCampos;
};

function etapaInteresse(pergunta: string, opcoes: string[]): Etapa {
  return {
    tipo: "perguntas",
    titulo: "Me conta um pouco mais",
    descricao: "",
    questoes: [
      {
        id: "q1",
        tipo: "multipla_escolha",
        pergunta,
        obrigatoria: true,
        opcoes: opcoes.map((texto, i) => ({ letra: String.fromCharCode(65 + i), texto })),
      },
    ],
  };
}

export const CAMPANHA_TEMPLATES: Record<CampanhaTemplateId, CampanhaTemplateDefinicao> = {
  matricula_aberta: {
    id: "matricula_aberta",
    nome: "Matrícula Aberta",
    descricao: "Para divulgar vagas abertas de um curso e captar interessados.",
    corDestaque: "#06b6d4",
    pedeCurso: true,
    pedeDataLimite: false,
    gerar: ({ titulo, subtitulo }) => ({
      titulo: titulo || "Matrículas abertas!",
      subtitulo: subtitulo || "Vagas limitadas — garanta sua vaga agora",
      descricao:
        "Sobre o curso: uma formação prática, com professores experientes e certificado reconhecido. Preencha seus dados que nossa equipe entra em contato.",
      cor_primaria: "#06b6d4",
      cor_fundo: "#0f172a",
      cor_fonte: "#ffffff",
      tema: "escuro",
      status: "ativa",
      mostrar_contador: false,
      contador_data_fim: null,
      coletar_email: false,
      coletar_cidade: true,
      cards_destaque: [
        { valor: "✅", label: "Aulas práticas" },
        { valor: "✅", label: "Professores experientes" },
        { valor: "✅", label: "Certificado reconhecido" },
      ],
      etapas: [etapaInteresse("Qual período você prefere?", ["Manhã", "Tarde", "Noite"])],
      titulo_sucesso: "Inscrição recebida! 🎓",
      mensagem_sucesso: "Em breve nossa equipe vai te chamar no WhatsApp para confirmar sua matrícula.",
    }),
  },
  evento_workshop: {
    id: "evento_workshop",
    nome: "Evento / Workshop",
    descricao: "Para inscrições em um evento, palestra ou workshop com data marcada.",
    corDestaque: "#8b5cf6",
    pedeCurso: false,
    pedeDataLimite: false,
    gerar: ({ titulo, subtitulo }) => ({
      titulo: titulo || "Workshop: [Título do evento]",
      subtitulo: subtitulo || "📅 [Data] — ⏰ [Horário] — 📍 [Local]",
      descricao: "O que você vai aprender: escreva aqui um resumo do conteúdo do workshop.",
      cor_primaria: "#8b5cf6",
      cor_fundo: "#0f172a",
      cor_fonte: "#ffffff",
      tema: "escuro",
      status: "ativa",
      mostrar_contador: false,
      contador_data_fim: null,
      coletar_email: true,
      coletar_cidade: false,
      cards_destaque: [],
      etapas: [etapaInteresse("O que mais te interessa nesse workshop?", ["Teoria", "Prática", "Networking", "Tudo isso"])],
      titulo_sucesso: "Inscrição confirmada! 🎉",
      mensagem_sucesso: "Te esperamos no evento! Qualquer novidade avisamos por WhatsApp.",
    }),
  },
  promocao_desconto: {
    id: "promocao_desconto",
    nome: "Promoção / Desconto",
    descricao: "Para uma oferta por tempo limitado, com contador regressivo até o fim do prazo.",
    corDestaque: "#f97316",
    pedeCurso: true,
    pedeDataLimite: true,
    gerar: ({ titulo, subtitulo, dataLimite }) => ({
      titulo: titulo || "🔥 Oferta especial!",
      subtitulo: subtitulo || "Somente até acabarem as vagas",
      descricao: "Garanta sua vaga com condição especial — por tempo limitado.",
      cor_primaria: "#f97316",
      cor_fundo: "#1c0a00",
      cor_fonte: "#ffffff",
      tema: "escuro",
      status: "ativa",
      mostrar_contador: !!dataLimite,
      contador_data_fim: dataLimite ? new Date(dataLimite).toISOString() : null,
      coletar_email: false,
      coletar_cidade: true,
      cards_destaque: [
        { valor: "De R$ X", label: "Preço cheio" },
        { valor: "Por R$ Y", label: "Com desconto" },
      ],
      etapas: [],
      titulo_sucesso: "Oferta garantida! 🔥",
      mensagem_sucesso: "Em breve nossa equipe confirma sua condição especial pelo WhatsApp.",
    }),
  },
  pagina_obrigado: {
    id: "pagina_obrigado",
    nome: "Página de Obrigado",
    descricao: "Para agradecer quem já converteu em outro canal — pede só o mínimo de dados.",
    corDestaque: "#22c55e",
    pedeCurso: false,
    pedeDataLimite: false,
    gerar: ({ titulo, subtitulo }) => ({
      titulo: titulo || "✅ Obrigado pelo contato!",
      subtitulo: subtitulo || "Recebemos seu interesse e entraremos em breve",
      descricao: "Enquanto isso, nos siga no Instagram pra ficar por dentro das novidades.",
      cor_primaria: "#22c55e",
      cor_fundo: "#0f172a",
      cor_fonte: "#ffffff",
      tema: "escuro",
      status: "ativa",
      mostrar_contador: false,
      contador_data_fim: null,
      coletar_email: false,
      coletar_cidade: false,
      cards_destaque: [],
      etapas: [],
      titulo_sucesso: "Tudo certo! ✅",
      mensagem_sucesso: "Em breve entraremos em contato. Enquanto isso, nos siga no Instagram!",
    }),
  },
};
