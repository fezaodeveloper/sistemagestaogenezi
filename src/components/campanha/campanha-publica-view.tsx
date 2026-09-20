"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { enviarRespostaCampanha } from "@/app/campanha/[slug]/actions";
import {
  CONFIRMACAO_TEXTO_DECLARACAO_PADRAO,
  CONFIRMACAO_TEXTO_LGPD,
  CONFIRMACAO_TEXTO_RESUMO_PADRAO,
  CONFIRMACAO_TITULO_PADRAO,
  PESO_TITULO_CSS,
  UFS_BRASIL,
  resolverTipografia,
  tipoQuestaoEfetivo,
  type CampanhaPagina,
  type Etapa,
  type Questao,
  type RespostaValor,
  type UfBrasil,
} from "@/lib/campanha-paginas/schema";
import { FONTE_CSS } from "@/lib/campanha-paginas/fontes";
import { dispararEventoPixels } from "@/lib/pixels/eventos-cliente";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Contagem = { dias: number; horas: number; minutos: number; segundos: number };

function calcularContagem(dataFimISO: string): Contagem {
  const diff = Math.max(0, new Date(dataFimISO).getTime() - Date.now());
  const segundosTotais = Math.floor(diff / 1000);
  return {
    dias: Math.floor(segundosTotais / 86400),
    horas: Math.floor((segundosTotais % 86400) / 3600),
    minutos: Math.floor((segundosTotais % 3600) / 60),
    segundos: segundosTotais % 60,
  };
}

function respostaPreenchida(questao: Questao, valor: RespostaValor | undefined): boolean {
  if (!questao.obrigatoria) return true;
  const tipo = tipoQuestaoEfetivo(questao);
  if (tipo === "checkbox_unico") return valor === true;
  // Grupo de checkboxes: obrigatória = pelo menos uma opção marcada.
  if (tipo === "checkbox") return Array.isArray(valor) && valor.length > 0;
  return typeof valor === "string" && valor.trim().length > 0;
}

// Fundo dos cards A/B/C/D é cor_primaria com opacidade reduzida quando não
// selecionado (pedido explícito) — não dá pra fazer isso só com a variável
// CSS --cor-primaria (não carrega canal alpha), por isso converte o hex pra
// rgba() aqui.
function hexParaRgba(hex: string, alpha: number): string {
  const valor = hex.replace("#", "");
  const r = parseInt(valor.slice(0, 2), 16);
  const g = parseInt(valor.slice(2, 4), 16);
  const b = parseInt(valor.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Rascunho = {
  nome: string;
  whatsapp: string;
  idade: string;
  email: string;
  estado: string;
  cidade: string;
  respostas: Record<string, RespostaValor>;
};

// Lê o rascunho do localStorage validando o formato campo a campo — o valor
// vem de fora do React (pode ter sido salvo por uma versão antiga da página
// ou editado à mão), então nunca é confiável.
function lerRascunho(chave: string): Partial<Rascunho> | null {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const dados: unknown = JSON.parse(bruto);
    if (typeof dados !== "object" || dados === null) return null;
    const d = dados as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" ? v : undefined);
    const respostas: Record<string, RespostaValor> = {};
    if (typeof d.respostas === "object" && d.respostas !== null) {
      for (const [k, v] of Object.entries(d.respostas)) {
        if (typeof v === "string" || typeof v === "boolean") respostas[k] = v;
        else if (Array.isArray(v) && v.every((item) => typeof item === "string")) respostas[k] = v as string[];
      }
    }
    return {
      nome: texto(d.nome),
      whatsapp: texto(d.whatsapp),
      idade: texto(d.idade),
      email: texto(d.email),
      estado: texto(d.estado),
      cidade: texto(d.cidade),
      respostas,
    };
  } catch {
    return null;
  }
}

// <select> HTML nativo (não o Select do Base UI) — pedido explícito, e o
// nativo funciona bem em celular. Estilizado com cor_fonte/cor_fundo/
// cor_primaria por valor direto, igual aos cards A/B/C/D.
function SelectNativo({
  id,
  valor,
  opcoes,
  placeholder,
  corPrimaria,
  corFundo,
  corFonte,
  disabled = false,
  onChange,
}: {
  id?: string;
  disabled?: boolean;
  valor: string;
  opcoes: { valor: string; texto: string }[];
  placeholder: string;
  corPrimaria: string;
  corFundo: string;
  corFonte: string;
  onChange: (valor: string) => void;
}) {
  return (
    <select
      id={id}
      value={valor}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-md px-2.5 text-[0.875em] outline-none disabled:cursor-not-allowed disabled:opacity-50"
      style={{ color: corFonte, backgroundColor: corFundo, border: `2px solid ${corPrimaria}` }}
    >
      <option value="" style={{ color: corFonte, backgroundColor: corFundo }}>
        {placeholder}
      </option>
      {opcoes.map((opcao, indice) => (
        <option key={`${indice}-${opcao.valor}`} value={opcao.valor} style={{ color: corFonte, backgroundColor: corFundo }}>
          {opcao.texto}
        </option>
      ))}
    </select>
  );
}

function QuestaoCampo({
  questao,
  valor,
  corPrimaria,
  corFundo,
  corFonte,
  onResponder,
}: {
  questao: Questao;
  valor: RespostaValor | undefined;
  corPrimaria: string;
  corFundo: string;
  corFonte: string;
  onResponder: (valor: RespostaValor) => void;
}) {
  const tipo = tipoQuestaoEfetivo(questao);

  if (tipo === "multipla_escolha") {
    return (
      <div className="flex flex-col gap-2">
        {(questao.opcoes ?? []).map((opcao) => {
          const selecionada = valor === opcao.letra;
          // Cores sempre passadas por valor direto (nunca via var(--...) CSS)
          // — mais fácil de depurar e não depende de herança através da
          // árvore do DOM. Selecionado: fundo sólido cor_primaria, texto
          // cor_fundo (contraste garantido). Não selecionado: contorno
          // cor_primaria, fundo cor_fundo bem translúcido, texto cor_fonte.
          const corTexto = selecionada ? corFundo : corFonte;
          return (
            <button
              key={opcao.letra}
              type="button"
              onClick={() => onResponder(opcao.letra)}
              style={{
                borderWidth: 2,
                borderStyle: "solid",
                borderColor: corPrimaria,
                backgroundColor: selecionada ? corPrimaria : hexParaRgba(corFundo, 0.3),
                color: corTexto,
              }}
              className="flex items-center gap-3 rounded-md p-3 text-left text-[0.875em] transition-colors"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.75em] font-semibold"
                style={{ color: selecionada ? corFundo : corPrimaria, borderColor: selecionada ? corFundo : corPrimaria }}
              >
                {opcao.letra}
              </span>
              <span style={{ color: corTexto }}>{opcao.texto}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Grupo de checkboxes: várias opções marcáveis; o valor é o array das
  // letras marcadas (na ordem das opções). Mesmo visual dos cards A/B/C/D.
  if (tipo === "checkbox") {
    const opcoes = questao.opcoes ?? [];
    const marcadas = Array.isArray(valor) ? valor : [];
    return (
      <div className="flex flex-col gap-2">
        {opcoes.map((opcao) => {
          const marcada = marcadas.includes(opcao.letra);
          const corTexto = marcada ? corFundo : corFonte;
          return (
            <button
              key={opcao.letra}
              type="button"
              role="checkbox"
              aria-checked={marcada}
              onClick={() => {
                const proximas = marcada ? marcadas.filter((l) => l !== opcao.letra) : [...marcadas, opcao.letra];
                onResponder(opcoes.filter((o) => proximas.includes(o.letra)).map((o) => o.letra));
              }}
              style={{
                borderWidth: 2,
                borderStyle: "solid",
                borderColor: corPrimaria,
                backgroundColor: marcada ? corPrimaria : hexParaRgba(corFundo, 0.3),
                color: corTexto,
              }}
              className="flex items-center gap-3 rounded-md p-3 text-left text-[0.875em] transition-colors"
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded border-2 text-[0.75em] font-bold"
                style={{ color: marcada ? corFundo : corPrimaria, borderColor: marcada ? corFundo : corPrimaria }}
              >
                {marcada ? "✓" : ""}
              </span>
              <span style={{ color: corTexto }}>
                {opcao.letra}. {opcao.texto}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Checkbox único (um "Sim") — o tipo "checkbox" antigo.
  if (tipo === "checkbox_unico") {
    return (
      <label className="flex items-center gap-2 text-[0.875em]" style={{ color: corFonte }}>
        <input type="checkbox" checked={valor === true} onChange={(event) => onResponder(event.target.checked)} />
        Sim
      </label>
    );
  }

  if (tipo === "select") {
    return (
      <SelectNativo
        valor={typeof valor === "string" ? valor : ""}
        opcoes={(questao.opcoes ?? []).map((o) => ({ valor: o.texto, texto: o.texto }))}
        placeholder="Selecione"
        corPrimaria={corPrimaria}
        corFundo={corFundo}
        corFonte={corFonte}
        onChange={onResponder}
      />
    );
  }

  return (
    <Textarea
      rows={3}
      value={typeof valor === "string" ? valor : ""}
      onChange={(event) => onResponder(event.target.value)}
      className="text-[1em] md:text-[1em]"
      style={{ color: corFonte }}
    />
  );
}

// `preview`: usado pelo editor do admin pra mostrar a página COMPLETA em tempo
// real — é o mesmo componente da página pública (fidelidade total), mas sem
// efeitos colaterais: não lê/grava rascunho no localStorage, não exige campos
// preenchidos pra navegar entre as etapas e o envio final só mostra a tela de
// sucesso, sem chamar a Server Action.
export function CampanhaPublicaView({
  pagina,
  encerrada = false,
  preview = false,
}: {
  pagina: CampanhaPagina;
  encerrada?: boolean;
  preview?: boolean;
}) {
  const escuro = pagina.tema === "escuro";
  const tipografia = useMemo(() => resolverTipografia(pagina.tipografia), [pagina.tipografia]);
  // Fonte/tamanho de texto/espaçamento entre seções vêm da aba Visual do editor
  // e são aplicados por style inline no container raiz; os textos internos usam
  // unidade `em` (text-[0.875em] etc.) pra escalar junto com o tamanho base.
  // "sistema" não define font-family (herda a fonte do app).
  const estiloTipografia: CSSProperties = {
    ...(tipografia.fonte !== "sistema" ? { fontFamily: FONTE_CSS[tipografia.fonte] } : {}),
    fontSize: tipografia.tamanho_texto,
  };
  const escalaTexto = "text-[1em] md:text-[1em]";
  const corCard = escuro ? "#1e293b" : "#f1f5f9";
  // QuestaoCampo recebe cor_fundo/cor_fonte/cor_primaria como props diretas
  // (não via variável CSS) — mais fácil de depurar e sem depender de
  // herança pela árvore do DOM. --cor-primaria continua como variável CSS
  // só para os dois usos que ficam dentro deste próprio componente (check
  // de sucesso e dígitos do contador), sem necessidade de prop.
  const style = { "--cor-primaria": pagina.cor_primaria, ...estiloTipografia } as CSSProperties;

  // Etapa de confirmação (opcional, sempre a última): substitui a tela final
  // padrão de termos/envio. As demais ("perguntas") viram as telas 1..N.
  const confirmacao = pagina.etapas.find((etapa) => etapa.tipo === "confirmacao") ?? null;
  const etapasPergunta = pagina.etapas.filter((etapa) => etapa.tipo !== "confirmacao");
  const cardsDestaque = pagina.cards_destaque ?? [];

  // Telas: 0 = dados básicos, 1..N = etapas de perguntas, N+1 = confirmação/envio.
  const totalTelas = 1 + etapasPergunta.length + 1;
  const [telaBruta, setTela] = useState(0);
  // No preview as etapas mudam enquanto o admin edita — mantém a tela dentro do intervalo.
  const tela = Math.min(telaBruta, totalTelas - 1);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [idade, setIdade] = useState("");
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  // Lista de municípios do estado escolhido. A lista estática (~90 KB) só é
  // baixada quando o visitante escolhe (ou o rascunho restaura) um estado.
  const [municipiosCarregados, setMunicipiosCarregados] = useState<{ uf: string; lista: readonly string[] } | null>(null);
  const [respostas, setRespostas] = useState<Record<string, RespostaValor>>({});
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [aceiteDeclaracao, setAceiteDeclaracao] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [contagem, setContagem] = useState<Contagem | null>(null);

  // Rascunho: localStorage só existe no client, então a restauração roda em
  // efeito (nunca no render inicial — senão o HTML do server diverge do
  // client e dá hydration mismatch). `rascunhoCarregado` impede o efeito de
  // salvar rodar antes da restauração e sobrescrever o rascunho com o estado
  // vazio inicial. Aceites de LGPD/declaração ficam de fora de propósito —
  // consentimento tem que ser dado de novo a cada envio.
  const chaveRascunho = `campanha_rascunho_${pagina.slug}`;
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);

  useEffect(() => {
    if (preview) return;
    queueMicrotask(() => {
      const rascunho = lerRascunho(chaveRascunho);
      if (rascunho) {
        setNome(rascunho.nome ?? "");
        setWhatsapp(rascunho.whatsapp ?? "");
        setIdade(rascunho.idade ?? "");
        setEmail(rascunho.email ?? "");
        setEstado(rascunho.estado ?? "");
        setCidade(rascunho.cidade ?? "");
        setRespostas(rascunho.respostas ?? {});
      }
      setRascunhoCarregado(true);
    });
  }, [chaveRascunho, preview]);

  useEffect(() => {
    if (preview || !rascunhoCarregado || sucesso) return;
    const rascunho: Rascunho = { nome, whatsapp, idade, email, estado, cidade, respostas };
    try {
      localStorage.setItem(chaveRascunho, JSON.stringify(rascunho));
    } catch {
      // localStorage indisponível (modo privado, cota cheia) — rascunho é só conveniência.
    }
  }, [preview, rascunhoCarregado, sucesso, chaveRascunho, nome, whatsapp, idade, email, estado, cidade, respostas]);

  useEffect(() => {
    if (!(UFS_BRASIL as readonly string[]).includes(estado)) return;
    let cancelado = false;
    import("@/lib/ibge/municipios").then(({ MUNICIPIOS_POR_UF }) => {
      // Ignora resposta atrasada se o estado mudou enquanto o módulo carregava.
      if (!cancelado) setMunicipiosCarregados({ uf: estado, lista: MUNICIPIOS_POR_UF[estado as UfBrasil] });
    });
    return () => {
      cancelado = true;
    };
  }, [estado]);

  const municipios = municipiosCarregados?.uf === estado ? municipiosCarregados.lista : [];
  // Cidade só vale se pertence ao estado (rascunho antigo tinha texto livre).
  const cidadeValida = municipios.includes(cidade);

  function escolherEstado(uf: string) {
    setEstado(uf);
    setCidade("");
  }

  useEffect(() => {
    if (!pagina.mostrar_contador || !pagina.contador_data_fim) return;
    const dataFim = pagina.contador_data_fim;
    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect) — o cálculo depende de Date.now(),
    // que só pode rodar no client (senão diverge do HTML do server e gera
    // hydration mismatch).
    queueMicrotask(() => setContagem(calcularContagem(dataFim)));
    const intervalo = setInterval(() => setContagem(calcularContagem(dataFim)), 1000);
    return () => clearInterval(intervalo);
  }, [pagina.mostrar_contador, pagina.contador_data_fim]);

  function responderQuestao(questaoId: string, valor: RespostaValor) {
    setRespostas((prev) => ({ ...prev, [questaoId]: valor }));
  }

  function avancar() {
    setError(null);
    setTela(Math.min(tela + 1, totalTelas - 1));
  }

  function voltar() {
    setError(null);
    setTela(Math.max(tela - 1, 0));
  }

  function podeAvancarDadosBasicos(): boolean {
    if (preview) return true;
    return (
      nome.trim().length > 0 &&
      whatsapp.trim().length > 0 &&
      idade.trim().length > 0 &&
      (!pagina.coletar_email || email.trim().length > 0) &&
      (!pagina.coletar_cidade || (estado.length > 0 && cidadeValida))
    );
  }

  function podeAvancarEtapa(etapa: Etapa): boolean {
    if (preview) return true;
    return etapa.questoes.every((q) => respostaPreenchida(q, respostas[q.id]));
  }

  function podeEnviar(): boolean {
    if (preview) return true;
    // Com etapa de confirmação os DOIS aceites são obrigatórios (independente
    // dos toggles da aba Termos, que valem só pra tela final padrão).
    if (confirmacao) return aceiteLgpd && aceiteDeclaracao;
    return (!pagina.mostrar_lgpd || aceiteLgpd) && (!pagina.mostrar_declaracao || aceiteDeclaracao);
  }

  function handleEnviar() {
    setError(null);
    if (preview) {
      setSucesso(true);
      return;
    }
    const formData = new FormData();
    formData.set("nome", nome);
    formData.set("whatsapp", whatsapp);
    formData.set("idade", idade);
    if (pagina.coletar_email) formData.set("email", email);
    formData.set("estado", estado);
    formData.set("cidade", cidade);
    formData.set("respostas", JSON.stringify(respostas));
    formData.set("aceite_lgpd", aceiteLgpd ? "on" : "");
    formData.set("aceite_declaracao", aceiteDeclaracao ? "on" : "");

    startTransition(async () => {
      const resultado = await enviarRespostaCampanha(pagina.slug, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      try {
        localStorage.removeItem(chaveRascunho);
      } catch {
        // sem localStorage — nada a limpar.
      }
      // Inscrição enviada com sucesso = lead pros pixels (no preview do editor não passa por aqui).
      dispararEventoPixels("lead");
      setSucesso(true);
    });
  }

  if (sucesso) {
    return (
      <div style={{ ...style, gap: tipografia.espacamento / 2 }} className="flex flex-col items-center py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full text-3xl" style={{ backgroundColor: "var(--cor-primaria)" }}>
          ✓
        </span>
        <h2 className="text-xl font-bold" style={{ color: pagina.cor_fonte }}>
          {pagina.titulo_sucesso}
        </h2>
        {pagina.mensagem_sucesso && <p style={{ color: pagina.cor_fonte }}>{pagina.mensagem_sucesso}</p>}
        {preview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSucesso(false);
              setTela(0);
            }}
          >
            Voltar ao início (preview)
          </Button>
        )}
      </div>
    );
  }

  const etapaAtual = tela >= 1 && tela <= etapasPergunta.length ? etapasPergunta[tela - 1] : null;
  const naEtapaFinal = tela === totalTelas - 1;

  return (
    <div style={{ ...style, gap: tipografia.espacamento }} className="flex flex-col">
      {encerrada && (
        <div role="alert" className="flex flex-col items-center gap-1 rounded-lg bg-red-600 px-4 py-3 text-center text-white">
          <p className="text-lg font-bold">Inscrições encerradas!</p>
          <p className="text-[0.875em] opacity-90">Essa campanha não está mais recebendo inscrições.</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        {pagina.imagem_topo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
          <img src={pagina.imagem_topo_url} alt="" className="w-full rounded-lg object-cover" />
        )}
        {/* Logo ABAIXO do banner/imagem principal. */}
        {pagina.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
          <img src={pagina.logo_url} alt={pagina.titulo} className="h-12 object-contain" />
        )}
        <h1
          style={{
            color: pagina.cor_fonte,
            fontSize: tipografia.tamanho_titulo,
            fontWeight: PESO_TITULO_CSS[tipografia.peso_titulo],
            lineHeight: 1.15,
          }}
        >
          {pagina.titulo}
        </h1>
        {pagina.subtitulo && <p style={{ color: pagina.cor_fonte }}>{pagina.subtitulo}</p>}
        {pagina.descricao && (
          <p className="text-[0.875em]" style={{ color: pagina.cor_fonte }}>
            {pagina.descricao}
          </p>
        )}
      </div>

      {cardsDestaque.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cardsDestaque.length}, minmax(0, 1fr))` }}>
          {cardsDestaque.map((card, indice) => (
            <div
              key={`${card.valor}-${indice}`}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-3 text-center"
              style={{
                backgroundColor: hexParaRgba(pagina.cor_primaria, 0.12),
                border: `1px solid ${hexParaRgba(pagina.cor_primaria, 0.4)}`,
              }}
            >
              <span className="text-xl font-extrabold sm:text-2xl" style={{ color: pagina.cor_primaria }}>
                {card.valor}
              </span>
              <span className="text-[10px] font-semibold tracking-wide uppercase sm:text-[0.75em]" style={{ color: pagina.cor_fonte }}>
                {card.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {contagem && !encerrada && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-[0.75em]" style={{ color: pagina.cor_fonte }}>
            Inscrições encerram em
          </p>
          <div className="flex gap-3 text-center">
            {[
              { label: "Dias", valor: contagem.dias },
              { label: "Horas", valor: contagem.horas },
              { label: "Min", valor: contagem.minutos },
              { label: "Seg", valor: contagem.segundos },
            ].map((item) => (
              <div key={item.label} className="flex flex-col">
                <span className="text-2xl font-bold" style={{ color: "var(--cor-primaria)" }}>
                  {String(item.valor).padStart(2, "0")}
                </span>
                <span className="text-[10px] uppercase" style={{ color: pagina.cor_fonte }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!encerrada && (
      <Card style={{ backgroundColor: corCard, borderColor: "transparent" }}>
        <CardContent className="flex flex-col gap-4">
          {tela === 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-[1em]" htmlFor="nome" style={{ color: pagina.cor_fonte }}>
                  Nome completo
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className={escalaTexto}
                  style={{ color: pagina.cor_fonte }}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[1em]" htmlFor="whatsapp" style={{ color: pagina.cor_fonte }}>
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  className={escalaTexto}
                  style={{ color: pagina.cor_fonte }}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[1em]" htmlFor="idade" style={{ color: pagina.cor_fonte }}>
                  Idade
                </Label>
                <Input
                  id="idade"
                  type="number"
                  min="1"
                  value={idade}
                  onChange={(event) => setIdade(event.target.value)}
                  className={escalaTexto}
                  style={{ color: pagina.cor_fonte }}
                  required
                />
              </div>
              {pagina.coletar_email && (
                <div className="flex flex-col gap-2">
                  <Label className="text-[1em]" htmlFor="email" style={{ color: pagina.cor_fonte }}>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={escalaTexto}
                    style={{ color: pagina.cor_fonte }}
                    required
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label className="text-[1em]" htmlFor="estado" style={{ color: pagina.cor_fonte }}>
                  Estado
                </Label>
                <SelectNativo
                  id="estado"
                  valor={estado}
                  opcoes={UFS_BRASIL.map((uf) => ({ valor: uf, texto: uf }))}
                  placeholder="Selecione o estado"
                  corPrimaria={pagina.cor_primaria}
                  corFundo={pagina.cor_fundo}
                  corFonte={pagina.cor_fonte}
                  onChange={escolherEstado}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[1em]" htmlFor="cidade" style={{ color: pagina.cor_fonte }}>
                  Município
                </Label>
                <SelectNativo
                  id="cidade"
                  valor={cidadeValida ? cidade : ""}
                  opcoes={municipios.map((municipio) => ({ valor: municipio, texto: municipio }))}
                  placeholder={estado ? "Selecione o município" : "Selecione o estado primeiro"}
                  corPrimaria={pagina.cor_primaria}
                  corFundo={pagina.cor_fundo}
                  corFonte={pagina.cor_fonte}
                  disabled={!estado}
                  onChange={setCidade}
                />
              </div>
              <Button type="button" className={escalaTexto} disabled={!podeAvancarDadosBasicos()} style={{ backgroundColor: pagina.cor_primaria }} onClick={avancar}>
                Continuar para a Etapa 2
              </Button>
            </div>
          )}

          {etapaAtual && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-medium" style={{ color: pagina.cor_fonte }}>
                  {etapaAtual.titulo}
                </p>
                {etapaAtual.descricao && (
                  <p className="text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                    {etapaAtual.descricao}
                  </p>
                )}
              </div>

              {etapaAtual.questoes.map((questao) => (
                <div key={questao.id} className="flex flex-col gap-2">
                  <Label className="text-[1em]" style={{ color: pagina.cor_fonte }}>{questao.pergunta}</Label>
                  <QuestaoCampo
                    questao={questao}
                    valor={respostas[questao.id]}
                    corPrimaria={pagina.cor_primaria}
                    corFundo={pagina.cor_fundo}
                    corFonte={pagina.cor_fonte}
                    onResponder={(valor) => {
                      responderQuestao(questao.id, valor);
                      // Múltipla escolha com uma única pergunta na etapa
                      // avança sozinha ao clicar — mesmo comportamento da
                      // referência (bolsagenezi.netlify.app). Etapas com
                      // mais de uma pergunta usam o botão "Continuar".
                      if (questao.tipo === "multipla_escolha" && etapaAtual.questoes.length === 1) {
                        setTimeout(avancar, 150);
                      }
                    }}
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={voltar} disabled={isPending}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  className={`flex-1 ${escalaTexto}`}
                  disabled={!podeAvancarEtapa(etapaAtual)}
                  style={{ backgroundColor: pagina.cor_primaria }}
                  onClick={avancar}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {naEtapaFinal && (
            <div className="flex flex-col gap-4">
              {confirmacao && (
                <div className="flex flex-col gap-1">
                  <p className="font-medium" style={{ color: pagina.cor_fonte }}>
                    {confirmacao.titulo || CONFIRMACAO_TITULO_PADRAO}
                  </p>
                  <p className="text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                    {confirmacao.texto_resumo || CONFIRMACAO_TEXTO_RESUMO_PADRAO}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-1 text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                <p>👤 {nome}</p>
                <p>📱 {whatsapp}</p>
              </div>

              {confirmacao ? (
                <>
                  {/* Os dois aceites são obrigatórios e nunca entram no rascunho
                      (localStorage) — consentimento tem que ser dado de novo. */}
                  <label className="flex items-start gap-2 text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                    <input
                      type="checkbox"
                      checked={aceiteDeclaracao}
                      onChange={(event) => setAceiteDeclaracao(event.target.checked)}
                      className="mt-0.5"
                    />
                    {confirmacao.texto_declaracao || CONFIRMACAO_TEXTO_DECLARACAO_PADRAO}
                  </label>
                  <label className="flex items-start gap-2 text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                    <input
                      type="checkbox"
                      checked={aceiteLgpd}
                      onChange={(event) => setAceiteLgpd(event.target.checked)}
                      className="mt-0.5"
                    />
                    {CONFIRMACAO_TEXTO_LGPD}
                  </label>
                </>
              ) : (
                <>
                  {pagina.mostrar_lgpd && (
                    <label className="flex items-start gap-2 text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                      <input type="checkbox" checked={aceiteLgpd} onChange={(event) => setAceiteLgpd(event.target.checked)} className="mt-0.5" />
                      {pagina.texto_lgpd || "Autorizo o tratamento dos meus dados pessoais conforme a LGPD."}
                    </label>
                  )}
                  {pagina.mostrar_declaracao && (
                    <label className="flex items-start gap-2 text-[0.875em]" style={{ color: pagina.cor_fonte }}>
                      <input type="checkbox" checked={aceiteDeclaracao} onChange={(event) => setAceiteDeclaracao(event.target.checked)} className="mt-0.5" />
                      {pagina.texto_declaracao || "Declaro ter interesse real nesta oportunidade."}
                    </label>
                  )}
                </>
              )}

              {error && (
                <p role="alert" className="text-[0.875em] text-red-400">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={voltar} disabled={isPending}>
                  Voltar
                </Button>
                <Button type="button" className={`flex-1 ${escalaTexto}`} disabled={!podeEnviar() || isPending} style={{ backgroundColor: pagina.cor_primaria }} onClick={handleEnviar}>
                  {isPending ? "Enviando..." : "Enviar minha inscrição"}
                </Button>
              </div>
            </div>
          )}

          {/* Rodapé de todas as telas: "Etapa X de Y" + barra proporcional (cor_primaria). */}
          <div className="flex flex-col gap-1.5 pt-2">
            <p className="text-[0.75em] font-medium" style={{ color: pagina.cor_fonte }}>
              Etapa {tela + 1} de {totalTelas}
            </p>
            <div
              role="progressbar"
              aria-label={`Etapa ${tela + 1} de ${totalTelas}`}
              aria-valuemin={1}
              aria-valuemax={totalTelas}
              aria-valuenow={tela + 1}
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: hexParaRgba(pagina.cor_fonte, 0.2) }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${((tela + 1) / totalTelas) * 100}%`, backgroundColor: pagina.cor_primaria }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
