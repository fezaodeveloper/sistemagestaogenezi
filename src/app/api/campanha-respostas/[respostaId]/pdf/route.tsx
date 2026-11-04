import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarLogoEscolaParaPdf } from "@/lib/pdf/logo-escola";
import { formatarRespostaCampanha, RESPOSTA_CHAVE_DECLARACAO, RESPOSTA_CHAVE_LGPD, type RespostaValor } from "@/lib/campanha-paginas/schema";
import { CampanhaResultadoPdf, type ResumoResultadoCampanha } from "@/components/pdf/campanha-resultado-pdf";

// Pública de propósito, mesmo padrão de /api/comprovantes/parcela/[parcelaId]/pdf: respostaId
// funciona como bearer token implícito — é assim que o participante anônimo (sem login, TAREFA
// campanha PARTE 3) consegue baixar o próprio resultado direto da tela de sucesso, e também como
// o admin imprime pela tela de respostas (service_role aqui, não tem RLS/sessão envolvida).
// .tsx (não .ts): renderToBuffer(<CampanhaResultadoPdf .../>) precisa de JSX.

type LinhaRespostaPdf = {
  nome: string;
  whatsapp: string;
  email: string | null;
  idade: number | null;
  respostas: Record<string, RespostaValor>;
  pontuacao_total: number | null;
  pontuacao_percentual: number | null;
  created_at: string;
  pagina_id: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ respostaId: string }> }) {
  const { respostaId } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("campanha_respostas")
    .select("nome, whatsapp, email, idade, respostas, pontuacao_total, pontuacao_percentual, created_at, pagina_id")
    .eq("id", respostaId)
    .maybeSingle();
  const resposta = data as LinhaRespostaPdf | null;
  if (!resposta) {
    return new Response("Resultado não encontrado.", { status: 404 });
  }

  const { data: paginaData } = await admin
    .from("campanha_paginas")
    .select("titulo, etapas, habilitar_pontuacao, pontuacao_maxima, pontuacao_minima_bolsa, mostrar_lgpd, mostrar_declaracao")
    .eq("id", resposta.pagina_id)
    .maybeSingle();

  type Questao = { id: string; pergunta: string; tipo: string };
  type Etapa = { tipo?: string; titulo: string; questoes: Questao[] };
  const pagina = paginaData as
    | {
        titulo: string;
        etapas: Etapa[];
        habilitar_pontuacao: boolean;
        pontuacao_maxima: number;
        pontuacao_minima_bolsa: number;
        mostrar_lgpd: boolean;
        mostrar_declaracao: boolean;
      }
    | null;

  const [{ data: configuracoes }, escolaLogo] = await Promise.all([
    admin.from("configuracoes").select("escola_nome, escola_logo_url").eq("id", true).maybeSingle(),
    carregarLogoEscolaParaPdf(),
  ]);

  const etapasPergunta = (pagina?.etapas ?? []).filter((etapa) => etapa.tipo !== "confirmacao");
  const temConfirmacao = (pagina?.etapas ?? []).some((etapa) => etapa.tipo === "confirmacao");
  const respostasPorEtapa = etapasPergunta
    .map((etapa) => ({
      tituloEtapa: etapa.titulo,
      respostas: etapa.questoes.map((questao) => ({
        pergunta: questao.pergunta,
        resposta: formatarRespostaCampanha(resposta.respostas?.[questao.id]),
      })),
    }))
    .filter((etapa) => etapa.respostas.length > 0);

  if (pagina?.mostrar_lgpd || temConfirmacao) {
    respostasPorEtapa.push({
      tituloEtapa: "Termos",
      respostas: [
        { pergunta: "Autorização LGPD", resposta: resposta.respostas?.[RESPOSTA_CHAVE_LGPD] ? "Aceito" : "Não aceito" },
        ...(pagina?.mostrar_declaracao || temConfirmacao
          ? [{ pergunta: "Declaração de interesse", resposta: resposta.respostas?.[RESPOSTA_CHAVE_DECLARACAO] ? "Aceita" : "Não aceita" }]
          : []),
      ],
    });
  }

  const habilitarPontuacao = !!pagina?.habilitar_pontuacao;
  const pontuacaoTotal = resposta.pontuacao_total ?? 0;
  const pontuacaoMaxima = pagina?.pontuacao_maxima ?? 100;
  const pontuacaoPercentual = resposta.pontuacao_percentual ?? 0;
  const aprovado = pontuacaoPercentual >= (pagina?.pontuacao_minima_bolsa ?? 0);

  const resumo: ResumoResultadoCampanha = {
    tituloCampanha: pagina?.titulo ?? "—",
    dataInscricao: new Date(resposta.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    participante: { nome: resposta.nome, whatsapp: resposta.whatsapp, email: resposta.email, idade: resposta.idade },
    habilitarPontuacao,
    pontuacaoTotal,
    pontuacaoMaxima,
    pontuacaoPercentual,
    aprovado,
    respostasPorEtapa,
    escolaNome: configuracoes?.escola_nome ?? undefined,
    escolaLogoUrl: escolaLogo,
  };

  const geradoEm = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const buffer = await renderToBuffer(<CampanhaResultadoPdf resumo={resumo} geradoEm={geradoEm} />);

  // new Uint8Array(buffer): mesma normalização já usada nas outras rotas de PDF deste projeto
  // (o generic de retorno de renderToBuffer não casa com o BodyInit que Response aceita).
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=resultado-campanha.pdf",
    },
  });
}
