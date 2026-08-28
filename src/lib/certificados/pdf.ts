import "server-only";

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CertificadoTemplate, MargensTexto } from "./schema";
import { tamanhoDoRun, tiptapJsonParaRuns, type TextoRun } from "./texto";

const TEMPLATE_BUCKET = "certificado-template";
const MARGEM = 40;
const ALTURA_LINHA_MULTIPLICADOR = 1.4;
// Encolhe a fonte em passos de 5% até o texto caber na caixa, sem passar
// de 30% do tamanho original — depois disso, corta linhas em vez de
// continuar encolhendo (texto ilegível não ajuda ninguém).
const FATOR_ENCOLHIMENTO_PASSO = 0.95;
const FATOR_ENCOLHIMENTO_MINIMO = 0.3;

const LOGO_TAMANHOS_PT: Record<CertificadoTemplate["logo_tamanho"], number> = {
  pequeno: 60,
  medio: 100,
  grande: 140,
};

type CorTexto = ReturnType<typeof rgb>;

const COR_TEXTO_PADRAO = rgb(0.1, 0.1, 0.1);

// #rrggbb (formato emitido por <input type="color">, validado no schema) ->
// RGB 0-1 do pdf-lib. Cai no padrão em vez de lançar se, por algum motivo,
// vier um valor fora do formato esperado (ex.: linha antiga sem a coluna
// preenchida) — cor errada nunca deveria travar a emissão do certificado.
function hexParaRgb(hex: string) {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!match) return COR_TEXTO_PADRAO;
  const [, r, g, b] = match;
  return rgb(parseInt(r, 16) / 255, parseInt(g, 16) / 255, parseInt(b, 16) / 255);
}

export async function gerarCertificadoPdf(dados: {
  template: CertificadoTemplate;
  nomeAluno: string;
  nomeCurso: string;
  cargaHorariaHoras: number | null;
  dataConclusao: Date;
  dataInicio: Date | null;
  cpf: string | null;
  aproveitamentoPercentual: number | null;
}): Promise<Uint8Array> {
  if (!dados.template.fundo_frente_url) {
    throw new Error("Configure a imagem de fundo da frente do certificado antes de emitir.");
  }
  if (!dados.template.fundo_verso_url) {
    throw new Error("Configure a imagem de fundo do verso do certificado antes de emitir.");
  }

  const admin = createAdminClient();
  const pdf = await PDFDocument.create();
  const fonteRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const variaveis: Record<string, string> = {
    nome_aluno: dados.nomeAluno,
    nome_curso: dados.nomeCurso,
    data_conclusao: formatarDataBR(dados.dataConclusao),
    data_inicio: dados.dataInicio ? formatarDataBR(dados.dataInicio) : "",
    carga_horaria: dados.cargaHorariaHoras ? `${dados.cargaHorariaHoras} horas` : "",
    cpf: dados.cpf ?? "",
    cidade: dados.template.cidade_emissao ?? "",
    estado: dados.template.estado_emissao ?? "",
    aproveitamento:
      dados.aproveitamentoPercentual != null ? `${dados.aproveitamentoPercentual}%` : "",
  };

  // ---- Frente ----
  const fundoFrenteBytes = await baixarArquivo(admin, dados.template.fundo_frente_url);
  const fundoFrenteImg = await embutirImagem(pdf, fundoFrenteBytes, dados.template.fundo_frente_url);
  const paginaFrente = pdf.addPage([fundoFrenteImg.width, fundoFrenteImg.height]);
  paginaFrente.drawImage(fundoFrenteImg, {
    x: 0,
    y: 0,
    width: fundoFrenteImg.width,
    height: fundoFrenteImg.height,
  });

  if (dados.template.logo_url && dados.template.logo_posicao !== "sem_logo") {
    const logoBytes = await baixarArquivo(admin, dados.template.logo_url);
    const logoImg = await embutirImagem(pdf, logoBytes, dados.template.logo_url);
    desenharLogo(paginaFrente, logoImg, dados.template.logo_posicao, dados.template.logo_tamanho);
  }

  desenharTextoCertificado(
    paginaFrente,
    tiptapJsonParaRuns(dados.template.texto_frente, variaveis),
    dados.template.texto_frente_margens,
    fonteRegular,
    fonteNegrito,
    hexParaRgb(dados.template.cor_texto_frente),
  );

  if (dados.template.assinatura_url) {
    const assinaturaBytes = await baixarArquivo(admin, dados.template.assinatura_url);
    const assinaturaImg = await embutirImagem(pdf, assinaturaBytes, dados.template.assinatura_url);
    desenharAssinatura(
      paginaFrente,
      assinaturaImg,
      dados.template.assinatura_x_percentual,
      dados.template.assinatura_y_percentual,
      dados.template.assinatura_largura_px,
    );
  }

  // ---- Verso ----
  const fundoVersoBytes = await baixarArquivo(admin, dados.template.fundo_verso_url);
  const fundoVersoImg = await embutirImagem(pdf, fundoVersoBytes, dados.template.fundo_verso_url);
  const paginaVerso = pdf.addPage([fundoVersoImg.width, fundoVersoImg.height]);
  paginaVerso.drawImage(fundoVersoImg, {
    x: 0,
    y: 0,
    width: fundoVersoImg.width,
    height: fundoVersoImg.height,
  });

  desenharTextoCertificado(
    paginaVerso,
    tiptapJsonParaRuns(dados.template.texto_verso, variaveis),
    dados.template.texto_verso_margens,
    fonteRegular,
    fonteNegrito,
    hexParaRgb(dados.template.cor_texto_verso),
  );

  return pdf.save();
}

async function baixarArquivo(admin: ReturnType<typeof createAdminClient>, path: string) {
  const { data, error } = await admin.storage.from(TEMPLATE_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Não foi possível carregar o arquivo "${path}" do template do certificado.`);
  }
  return data.arrayBuffer();
}

async function embutirImagem(
  pdf: PDFDocument,
  bytes: ArrayBuffer,
  path: string,
): Promise<PDFImage> {
  const extensao = path.split(".").pop()?.toLowerCase();
  if (extensao === "png") return pdf.embedPng(bytes);
  return pdf.embedJpg(bytes);
}

function desenharLogo(
  page: PDFPage,
  logoImg: PDFImage,
  posicao: CertificadoTemplate["logo_posicao"],
  tamanho: CertificadoTemplate["logo_tamanho"],
) {
  const maxDim = LOGO_TAMANHOS_PT[tamanho];
  const escala = Math.min(maxDim / logoImg.width, maxDim / logoImg.height, 1);
  const largura = logoImg.width * escala;
  const altura = logoImg.height * escala;
  const y = page.getHeight() - MARGEM - altura;

  let x: number;
  if (posicao === "topo_centro") x = (page.getWidth() - largura) / 2;
  else if (posicao === "superior_esquerdo") x = MARGEM;
  else x = page.getWidth() - MARGEM - largura;

  page.drawImage(logoImg, { x, y, width: largura, height: altura });
}

// x/y em % da página, origem no topo-esquerda (0% = topo/esquerda),
// (x,y) marca o CENTRO da assinatura — mesma convenção documentada no
// formulário de template. Largura em px (= pt, já que a página nasce no
// tamanho em pixels da imagem de fundo), altura preserva a proporção.
function desenharAssinatura(
  page: PDFPage,
  img: PDFImage,
  xPercentual: number,
  yPercentual: number,
  larguraPx: number,
) {
  const escala = larguraPx / img.width;
  const largura = larguraPx;
  const altura = img.height * escala;

  const centroX = page.getWidth() * (xPercentual / 100);
  const centroYDoTopo = page.getHeight() * (yPercentual / 100);
  const centroY = page.getHeight() - centroYDoTopo;

  page.drawImage(img, {
    x: centroX - largura / 2,
    y: centroY - altura / 2,
    width: largura,
    height: altura,
  });
}

// Converte as margens em % em uma caixa concreta (pt), mesma unidade da
// página. Se as margens somarem 100%+ num eixo, a caixa vira 0 largura ou
// 0 altura — dividirEmLinhas simplesmente não encontra espaço pra nenhuma
// palavra e a linha fica vazia, não quebra o desenho.
function calcularCaixaTexto(page: PDFPage, margens: MargensTexto) {
  const largura = page.getWidth();
  const altura = page.getHeight();
  const esquerda = largura * (margens.esquerda / 100);
  const direita = largura * (1 - margens.direita / 100);
  const topo = altura * (1 - margens.superior / 100);
  const base = altura * (margens.inferior / 100);
  return {
    x: esquerda,
    largura: Math.max(direita - esquerda, 0),
    topo,
    base,
    altura: Math.max(topo - base, 0),
  };
}

function desenharTextoCertificado(
  page: PDFPage,
  runs: TextoRun[],
  margens: MargensTexto,
  fonteRegular: PDFFont,
  fonteNegrito: PDFFont,
  cor: CorTexto,
) {
  const caixa = calcularCaixaTexto(page, margens);
  const linhas = ajustarLinhasParaCaber(runs, fonteRegular, fonteNegrito, caixa);
  desenharTexto(page, linhas, caixa, fonteRegular, fonteNegrito, cor);
}

function escalarRun(run: TextoRun, fator: number): TextoRun {
  return fator === 1 ? run : { ...run, tamanhoFonte: tamanhoDoRun(run) * fator };
}

function alturaTotalDasLinhas(linhas: TextoRun[][]): number {
  return linhas.reduce((soma, linha) => {
    const maiorTamanho = linha.reduce((max, run) => Math.max(max, tamanhoDoRun(run)), 0);
    return soma + maiorTamanho * ALTURA_LINHA_MULTIPLICADOR;
  }, 0);
}

// Garante que o texto nunca vaza pra fora da caixa de margens: primeiro
// tenta encolher a fonte proporcionalmente (recalculando a quebra de
// linha a cada tentativa, já que um tamanho menor cabe mais palavra por
// linha) até a altura total caber; se mesmo no encolhimento mínimo ainda
// não couber, corta as linhas excedentes em vez de deixar vazar.
function ajustarLinhasParaCaber(
  runs: TextoRun[],
  fonteRegular: PDFFont,
  fonteNegrito: PDFFont,
  caixa: { largura: number; altura: number },
): TextoRun[][] {
  let fator = 1;
  let linhas = dividirEmLinhas(
    runs.map((r) => escalarRun(r, fator)),
    fonteRegular,
    fonteNegrito,
    caixa.largura,
  );

  while (alturaTotalDasLinhas(linhas) > caixa.altura && fator > FATOR_ENCOLHIMENTO_MINIMO) {
    fator *= FATOR_ENCOLHIMENTO_PASSO;
    linhas = dividirEmLinhas(
      runs.map((r) => escalarRun(r, fator)),
      fonteRegular,
      fonteNegrito,
      caixa.largura,
    );
  }

  if (alturaTotalDasLinhas(linhas) > caixa.altura) {
    let alturaAcumulada = 0;
    const linhasQueCabem: TextoRun[][] = [];
    for (const linha of linhas) {
      const maiorTamanho = linha.reduce((max, run) => Math.max(max, tamanhoDoRun(run)), 0);
      const alturaLinha = maiorTamanho * ALTURA_LINHA_MULTIPLICADOR;
      if (alturaAcumulada + alturaLinha > caixa.altura) break;
      linhasQueCabem.push(linha);
      alturaAcumulada += alturaLinha;
    }
    linhas = linhasQueCabem;
  }

  return linhas;
}

function dividirEmLinhas(
  runs: TextoRun[],
  fonteRegular: PDFFont,
  fonteNegrito: PDFFont,
  larguraMaxima: number,
): TextoRun[][] {
  const linhas: TextoRun[][] = [];
  let linhaAtual: TextoRun[] = [];
  let larguraAtual = 0;

  for (const run of runs) {
    const fonte = run.negrito ? fonteNegrito : fonteRegular;
    const tamanho = tamanhoDoRun(run);
    const paragrafos = run.texto.split("\n");

    paragrafos.forEach((paragrafo, i) => {
      if (i > 0) {
        linhas.push(linhaAtual);
        linhaAtual = [];
        larguraAtual = 0;
      }

      const palavras = paragrafo.split(/(\s+)/).filter((p) => p.length > 0);
      for (const palavra of palavras) {
        const larguraPalavra = fonte.widthOfTextAtSize(palavra, tamanho);
        if (larguraAtual + larguraPalavra > larguraMaxima && linhaAtual.length > 0) {
          linhas.push(linhaAtual);
          linhaAtual = [];
          larguraAtual = 0;
        }
        linhaAtual.push({
          texto: palavra,
          negrito: run.negrito,
          sublinhado: run.sublinhado,
          tamanhoFonte: run.tamanhoFonte,
        });
        larguraAtual += larguraPalavra;
      }
    });
  }
  if (linhaAtual.length > 0) linhas.push(linhaAtual);
  return linhas;
}

function desenharTexto(
  page: PDFPage,
  linhas: TextoRun[][],
  caixa: { x: number; largura: number; topo: number; base: number; altura: number },
  fonteRegular: PDFFont,
  fonteNegrito: PDFFont,
  cor: CorTexto,
) {
  const alturasLinha = linhas.map((linha) => {
    const maiorTamanho = linha.reduce((max, run) => Math.max(max, tamanhoDoRun(run)), 0);
    return maiorTamanho * ALTURA_LINHA_MULTIPLICADOR;
  });
  const alturaTotal = alturaTotalDasLinhas(linhas);

  let y = caixa.base + caixa.altura / 2 + alturaTotal / 2;

  linhas.forEach((linha, indice) => {
    const alturaLinha = alturasLinha[indice];
    y -= alturaLinha;
    // Aproxima a linha de base da fonte maior da linha, pra texto com
    // tamanhos mistos não boiar acima da posição visual esperada.
    const maiorTamanho = linha.reduce((max, run) => Math.max(max, tamanhoDoRun(run)), 0);
    const yTexto = y + (alturaLinha - maiorTamanho) / 2;

    const larguraLinha = linha.reduce((acc, run) => {
      const fonte = run.negrito ? fonteNegrito : fonteRegular;
      return acc + fonte.widthOfTextAtSize(run.texto, tamanhoDoRun(run));
    }, 0);

    let x = caixa.x + (caixa.largura - larguraLinha) / 2;
    for (const run of linha) {
      const fonte = run.negrito ? fonteNegrito : fonteRegular;
      const tamanho = tamanhoDoRun(run);
      const largura = fonte.widthOfTextAtSize(run.texto, tamanho);
      page.drawText(run.texto, { x, y: yTexto, size: tamanho, font: fonte, color: cor });
      if (run.sublinhado && run.texto.length > 0) {
        page.drawLine({
          start: { x, y: yTexto - 3 },
          end: { x: x + largura, y: yTexto - 3 },
          thickness: 1,
          color: cor,
        });
      }
      x += largura;
    }
  });
}

function formatarDataBR(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
