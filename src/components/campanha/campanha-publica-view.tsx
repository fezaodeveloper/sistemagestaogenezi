"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { enviarRespostaCampanha } from "@/app/campanha/[slug]/actions";
import type { CampanhaPagina, Etapa, Questao } from "@/lib/campanha-paginas/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function respostaPreenchida(questao: Questao, valor: string | boolean | undefined): boolean {
  if (!questao.obrigatoria) return true;
  if (questao.tipo === "checkbox") return valor === true;
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

function QuestaoCampo({
  questao,
  valor,
  corPrimaria,
  corFundo,
  corFonte,
  onResponder,
}: {
  questao: Questao;
  valor: string | boolean | undefined;
  corPrimaria: string;
  corFundo: string;
  corFonte: string;
  onResponder: (valor: string | boolean) => void;
}) {
  if (questao.tipo === "multipla_escolha") {
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
              className="flex items-center gap-3 rounded-md p-3 text-left text-sm transition-colors"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold"
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

  if (questao.tipo === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm" style={{ color: corFonte }}>
        <input type="checkbox" checked={valor === true} onChange={(event) => onResponder(event.target.checked)} />
        Sim
      </label>
    );
  }

  if (questao.tipo === "select") {
    const opcoesItems = Object.fromEntries((questao.opcoes ?? []).map((o) => [o.texto, o.texto]));
    return (
      <Select items={opcoesItems} value={typeof valor === "string" ? valor : ""} onValueChange={(v) => v && onResponder(v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {(questao.opcoes ?? []).map((opcao) => (
            <SelectItem key={opcao.letra} value={opcao.texto}>
              {opcao.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Textarea
      rows={3}
      value={typeof valor === "string" ? valor : ""}
      onChange={(event) => onResponder(event.target.value)}
      style={{ color: corFonte }}
    />
  );
}

export function CampanhaPublicaView({ pagina }: { pagina: CampanhaPagina }) {
  const escuro = pagina.tema === "escuro";
  const corCard = escuro ? "#1e293b" : "#f1f5f9";
  // QuestaoCampo recebe cor_fundo/cor_fonte/cor_primaria como props diretas
  // (não via variável CSS) — mais fácil de depurar e sem depender de
  // herança pela árvore do DOM. --cor-primaria continua como variável CSS
  // só para os dois usos que ficam dentro deste próprio componente (check
  // de sucesso e dígitos do contador), sem necessidade de prop.
  const style = { "--cor-primaria": pagina.cor_primaria } as CSSProperties;

  // Telas: 0 = dados básicos, 1..N = etapas configuradas, N+1 = termos/envio.
  const totalTelas = 1 + pagina.etapas.length + 1;
  const [tela, setTela] = useState(0);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [idade, setIdade] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string | boolean>>({});
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [aceiteDeclaracao, setAceiteDeclaracao] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [contagem, setContagem] = useState<Contagem | null>(null);

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

  function responderQuestao(questaoId: string, valor: string | boolean) {
    setRespostas((prev) => ({ ...prev, [questaoId]: valor }));
  }

  function avancar() {
    setError(null);
    setTela((t) => Math.min(t + 1, totalTelas - 1));
  }

  function voltar() {
    setError(null);
    setTela((t) => Math.max(t - 1, 0));
  }

  function podeAvancarDadosBasicos(): boolean {
    return (
      nome.trim().length > 0 &&
      whatsapp.trim().length > 0 &&
      idade.trim().length > 0 &&
      (!pagina.coletar_email || email.trim().length > 0) &&
      (!pagina.coletar_cidade || cidade.trim().length > 0)
    );
  }

  function podeAvancarEtapa(etapa: Etapa): boolean {
    return etapa.questoes.every((q) => respostaPreenchida(q, respostas[q.id]));
  }

  function podeEnviar(): boolean {
    return (!pagina.mostrar_lgpd || aceiteLgpd) && (!pagina.mostrar_declaracao || aceiteDeclaracao);
  }

  function handleEnviar() {
    setError(null);
    const formData = new FormData();
    formData.set("nome", nome);
    formData.set("whatsapp", whatsapp);
    formData.set("idade", idade);
    if (pagina.coletar_email) formData.set("email", email);
    if (pagina.coletar_cidade) formData.set("cidade", cidade);
    formData.set("respostas", JSON.stringify(respostas));
    formData.set("aceite_lgpd", aceiteLgpd ? "on" : "");
    formData.set("aceite_declaracao", aceiteDeclaracao ? "on" : "");

    startTransition(async () => {
      const resultado = await enviarRespostaCampanha(pagina.slug, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setSucesso(true);
    });
  }

  if (sucesso) {
    return (
      <div style={style} className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full text-3xl" style={{ backgroundColor: "var(--cor-primaria)" }}>
          ✓
        </span>
        <h2 className="text-xl font-bold" style={{ color: pagina.cor_fonte }}>
          {pagina.titulo_sucesso}
        </h2>
        {pagina.mensagem_sucesso && <p style={{ color: pagina.cor_fonte }}>{pagina.mensagem_sucesso}</p>}
      </div>
    );
  }

  const etapaAtual = tela >= 1 && tela <= pagina.etapas.length ? pagina.etapas[tela - 1] : null;
  const naEtapaFinal = tela === totalTelas - 1;

  return (
    <div style={style} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {pagina.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
          <img src={pagina.logo_url} alt={pagina.titulo} className="h-12 object-contain" />
        )}
        {pagina.imagem_topo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
          <img src={pagina.imagem_topo_url} alt="" className="w-full rounded-lg object-cover" />
        )}
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: pagina.cor_fonte }}>
          {pagina.titulo}
        </h1>
        {pagina.subtitulo && <p style={{ color: pagina.cor_fonte }}>{pagina.subtitulo}</p>}
        {pagina.descricao && (
          <p className="text-sm" style={{ color: pagina.cor_fonte }}>
            {pagina.descricao}
          </p>
        )}
      </div>

      {contagem && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs" style={{ color: pagina.cor_fonte }}>
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

      <Card style={{ backgroundColor: corCard, borderColor: "transparent" }}>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs font-medium" style={{ color: pagina.cor_fonte }}>
            Etapa {tela + 1} de {totalTelas}
          </p>

          {tela === 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nome" style={{ color: pagina.cor_fonte }}>
                  Nome completo
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  style={{ color: pagina.cor_fonte }}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="whatsapp" style={{ color: pagina.cor_fonte }}>
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  style={{ color: pagina.cor_fonte }}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="idade" style={{ color: pagina.cor_fonte }}>
                  Idade
                </Label>
                <Input
                  id="idade"
                  type="number"
                  min="1"
                  value={idade}
                  onChange={(event) => setIdade(event.target.value)}
                  style={{ color: pagina.cor_fonte }}
                  required
                />
              </div>
              {pagina.coletar_email && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" style={{ color: pagina.cor_fonte }}>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={{ color: pagina.cor_fonte }}
                    required
                  />
                </div>
              )}
              {pagina.coletar_cidade && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cidade" style={{ color: pagina.cor_fonte }}>
                    Cidade
                  </Label>
                  <Input
                    id="cidade"
                    value={cidade}
                    onChange={(event) => setCidade(event.target.value)}
                    style={{ color: pagina.cor_fonte }}
                    required
                  />
                </div>
              )}
              <Button type="button" disabled={!podeAvancarDadosBasicos()} style={{ backgroundColor: pagina.cor_primaria }} onClick={avancar}>
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
                  <p className="text-sm" style={{ color: pagina.cor_fonte }}>
                    {etapaAtual.descricao}
                  </p>
                )}
              </div>

              {etapaAtual.questoes.map((questao) => (
                <div key={questao.id} className="flex flex-col gap-2">
                  <Label style={{ color: pagina.cor_fonte }}>{questao.pergunta}</Label>
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
                  className="flex-1"
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
              <div className="flex flex-col gap-1 text-sm" style={{ color: pagina.cor_fonte }}>
                <p>👤 {nome}</p>
                <p>📱 {whatsapp}</p>
              </div>

              {pagina.mostrar_lgpd && (
                <label className="flex items-start gap-2 text-sm" style={{ color: pagina.cor_fonte }}>
                  <input type="checkbox" checked={aceiteLgpd} onChange={(event) => setAceiteLgpd(event.target.checked)} className="mt-0.5" />
                  {pagina.texto_lgpd || "Autorizo o tratamento dos meus dados pessoais conforme a LGPD."}
                </label>
              )}
              {pagina.mostrar_declaracao && (
                <label className="flex items-start gap-2 text-sm" style={{ color: pagina.cor_fonte }}>
                  <input type="checkbox" checked={aceiteDeclaracao} onChange={(event) => setAceiteDeclaracao(event.target.checked)} className="mt-0.5" />
                  {pagina.texto_declaracao || "Declaro ter interesse real nesta oportunidade."}
                </label>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={voltar} disabled={isPending}>
                  Voltar
                </Button>
                <Button type="button" className="flex-1" disabled={!podeEnviar() || isPending} style={{ backgroundColor: pagina.cor_primaria }} onClick={handleEnviar}>
                  {isPending ? "Enviando..." : "Enviar minha inscrição"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
