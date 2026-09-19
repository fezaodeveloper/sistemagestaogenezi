"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { criarAgendamentoPublico } from "@/app/agendar/[slug]/actions";
import { AGENDAMENTO_JANELA_DIAS, type AgendamentoPagina } from "@/lib/agendamentos/schema";
import { dataComDiaSemana } from "@/lib/datas/util";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DIAS_SEMANA_CURTO = ["D", "S", "T", "Q", "Q", "S", "S"];
const MENSAGEM_MAXIMO = 500;

function toISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function diasDoMes(mes: Date): (Date | null)[] {
  const ano = mes.getFullYear();
  const mesIndex = mes.getMonth();
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia = new Date(ano, mesIndex + 1, 0);
  const dias: (Date | null)[] = [];
  for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null);
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(ano, mesIndex, d));
  return dias;
}

// "(11) 99999-9999" enquanto digita (10 ou 11 dígitos).
function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function nomeDoMes(mes: Date): string {
  const nome = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

type StatusDia = "indisponivel" | "lotado" | "disponivel";

// Estado de um dia no calendário:
//  - indisponivel: sem horário configurado nesse dia da semana, antes da
//    antecedência mínima, fora do período da página ou além da janela de
//    disponibilidade calculada;
//  - lotado: tem horários, mas TODOS já estão com as vagas preenchidas;
//  - disponivel: pelo menos um horário com vaga.
function calcularStatusDia(
  data: Date,
  contexto: {
    pagina: AgendamentoPagina;
    horariosPorDiaSemana: Map<number, string[]>;
    contagemPorHorario: Record<string, number>;
    lotadosLocais: Set<string>;
    dataMinimaISO: string;
    dataLimiteISO: string;
  },
): StatusDia {
  const { pagina, horariosPorDiaSemana, contagemPorHorario, lotadosLocais, dataMinimaISO, dataLimiteISO } = contexto;
  const iso = toISO(data);
  const horarios = horariosPorDiaSemana.get(data.getDay());
  if (!horarios || horarios.length === 0) return "indisponivel";
  if (iso < dataMinimaISO || iso > dataLimiteISO) return "indisponivel";
  if (pagina.data_inicio && iso < pagina.data_inicio) return "indisponivel";
  if (pagina.data_fim && iso > pagina.data_fim) return "indisponivel";

  const todosLotados = horarios.every((horario) => {
    const chave = `${iso}_${horario}`;
    return (contagemPorHorario[chave] ?? 0) >= pagina.vagas_por_horario || lotadosLocais.has(chave);
  });
  return todosLotados ? "lotado" : "disponivel";
}

export function AgendamentoPublicoView({
  pagina,
  contagemPorHorario,
}: {
  pagina: AgendamentoPagina;
  contagemPorHorario: Record<string, number>;
}) {
  const hoje = useMemo(() => new Date(), []);

  const dataMinimaISO = useMemo(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + pagina.dias_antecedencia_minimo);
    return toISO(d);
  }, [hoje, pagina.dias_antecedencia_minimo]);

  // Até onde dá pra agendar: a janela de disponibilidade calculada pelo
  // servidor (AGENDAMENTO_JANELA_DIAS) ou o fim do período da página, o que
  // vier primeiro. Além disso o calendário não deixa navegar (não haveria
  // contagem de vagas confiável e a data nem seria aceita).
  const dataLimiteISO = useMemo(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + AGENDAMENTO_JANELA_DIAS);
    const janela = toISO(d);
    return pagina.data_fim && pagina.data_fim < janela ? pagina.data_fim : janela;
  }, [hoje, pagina.data_fim]);

  const horariosPorDiaSemana = useMemo(() => {
    const mapa = new Map<number, string[]>();
    for (const { dia_semana, horario } of pagina.horarios_disponiveis) {
      mapa.set(dia_semana, [...(mapa.get(dia_semana) ?? []), horario]);
    }
    for (const horarios of mapa.values()) horarios.sort((a, b) => a.localeCompare(b));
    return mapa;
  }, [pagina.horarios_disponiveis]);

  // Horários que o servidor recusou por lotação durante ESTA sessão (o mapa de
  // contagem vem do carregamento da página e fica desatualizado).
  const [lotadosLocais, setLotadosLocais] = useState<Set<string>>(() => new Set());

  const contexto = { pagina, horariosPorDiaSemana, contagemPorHorario, lotadosLocais, dataMinimaISO, dataLimiteISO };
  const statusDia = (data: Date) => calcularStatusDia(data, contexto);

  // Primeiro dia com vaga (a partir de hoje): o calendário já abre nesse mês,
  // em vez de abrir num mês vazio quando a página só começa daqui a um tempo.
  const primeiroDiaDisponivel = useMemo(() => {
    const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    for (let i = 0; i <= AGENDAMENTO_JANELA_DIAS; i++) {
      if (
        calcularStatusDia(cursor, {
          pagina,
          horariosPorDiaSemana,
          contagemPorHorario,
          lotadosLocais: new Set(),
          dataMinimaISO,
          dataLimiteISO,
        }) === "disponivel"
      ) {
        return new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return null;
  }, [hoje, pagina, horariosPorDiaSemana, contagemPorHorario, dataMinimaISO, dataLimiteISO]);

  const [mesAtual, setMesAtual] = useState(() => {
    const base = primeiroDiaDisponivel ?? hoje;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [camposExtras, setCamposExtras] = useState<Record<string, string>>({});
  const [aceite, setAceite] = useState(false);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroHorario, setErroHorario] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const corPrimaria = pagina.cor_primaria;
  const style = { "--cor-primaria": corPrimaria } as CSSProperties;

  const horariosDoDiaSelecionado = useMemo(() => {
    if (!dataSelecionada) return [];
    const diaSemana = new Date(`${dataSelecionada}T00:00:00`).getDay();
    return (horariosPorDiaSemana.get(diaSemana) ?? []).map((horario) => {
      const chave = `${dataSelecionada}_${horario}`;
      return {
        horario,
        lotado: (contagemPorHorario[chave] ?? 0) >= pagina.vagas_por_horario || lotadosLocais.has(chave),
      };
    });
  }, [dataSelecionada, horariosPorDiaSemana, pagina.vagas_por_horario, contagemPorHorario, lotadosLocais]);

  const mesAnteriorDesabilitado =
    mesAtual.getFullYear() === hoje.getFullYear() && mesAtual.getMonth() === hoje.getMonth();
  const proximoMesDesabilitado =
    toISO(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1)) > dataLimiteISO;
  const mesSemDisponibilidade = !diasDoMes(mesAtual).some((data) => data && statusDia(data) === "disponivel");

  function irParaProximoMes() {
    setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  // Validação por campo (mostrada depois da 1ª tentativa de continuar, e
  // atualizada ao vivo enquanto a pessoa corrige).
  const errosPasso2 = {
    nome: nome.trim().length < 2 ? "Informe seu nome completo." : null,
    whatsapp: whatsapp.replace(/\D/g, "").length < 10 ? "Informe um WhatsApp válido, com DDD." : null,
    aceite: !aceite ? "É preciso concordar para continuar." : null,
  };

  function avancarDoPasso2() {
    setTentouAvancar(true);
    if (errosPasso2.nome || errosPasso2.whatsapp || errosPasso2.aceite) return;
    setPasso(3);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("data_agendada", dataSelecionada ?? "");
    formData.set("horario", horarioSelecionado ?? "");
    formData.set("campos_extras", JSON.stringify(camposExtras));
    formData.set("mensagem", mensagem);

    startTransition(async () => {
      const resultado = await criarAgendamentoPublico(pagina.slug, formData);
      if ("error" in resultado) {
        if (resultado.slotIndisponivel && dataSelecionada && horarioSelecionado) {
          // Horário lotou enquanto a pessoa preenchia: volta pra escolha,
          // marca o horário como lotado e explica — em vez de deixá-la presa
          // na confirmação com o mesmo horário recusado.
          const chave = `${dataSelecionada}_${horarioSelecionado}`;
          setLotadosLocais((prev) => new Set(prev).add(chave));
          setHorarioSelecionado(null);
          setErroHorario(resultado.error);
          setPasso(1);
          return;
        }
        setError(resultado.error);
        return;
      }
      setSucesso(true);
    });
  }

  const resumoData = dataSelecionada ? dataComDiaSemana(dataSelecionada) : "";

  if (sucesso) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-lg font-medium">✅ Agendamento confirmado!</p>

          <div className="bg-muted/50 flex w-full flex-col gap-1.5 rounded-md p-4 text-left text-sm">
            <p>📋 {pagina.titulo}</p>
            <p>📅 {resumoData}</p>
            <p>⏰ {horarioSelecionado}</p>
            <p>👤 {nome}</p>
          </div>

          <p className="text-muted-foreground text-sm">
            {pagina.mensagem_confirmacao ?? "Em breve entraremos em contato pelo WhatsApp para confirmar."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={style} className="flex flex-col gap-4">
      {/* Progresso: 3 passos */}
      <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo} aria-label={`Passo ${passo} de 3`}>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: n <= passo ? corPrimaria : "var(--muted)" }}
          />
        ))}
      </div>

      {passo === 1 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm font-medium">1. Escolha uma data e horário</p>

            {erroHorario && (
              <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {erroHorario}
              </p>
            )}

            {primeiroDiaDisponivel === null && (
              <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                No momento não há datas com vagas disponíveis. Volte mais tarde ou entre em contato com a escola.
              </p>
            )}

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={mesAnteriorDesabilitado}
                onClick={() => setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium" aria-live="polite">
                {nomeDoMes(mesAtual)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={proximoMesDesabilitado}
                onClick={irParaProximoMes}
                aria-label="Próximo mês"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {DIAS_SEMANA_CURTO.map((d, i) => (
                <span key={i} className="text-muted-foreground py-1">
                  {d}
                </span>
              ))}
              {diasDoMes(mesAtual).map((data, index) => {
                if (!data) return <span key={index} />;
                const iso = toISO(data);
                const status = statusDia(data);
                const selecionado = iso === dataSelecionada;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={status !== "disponivel"}
                    aria-pressed={selecionado}
                    aria-label={`${dataComDiaSemana(iso)}${status === "lotado" ? " — sem vagas" : status === "indisponivel" ? " — indisponível" : ""}`}
                    title={status === "lotado" ? "Sem vagas" : undefined}
                    onClick={() => {
                      setDataSelecionada(iso);
                      setHorarioSelecionado(null);
                      setErroHorario(null);
                    }}
                    style={selecionado ? { backgroundColor: corPrimaria, color: "#fff" } : undefined}
                    className={
                      "flex aspect-square min-h-9 items-center justify-center rounded-md text-sm transition-colors " +
                      (status === "disponivel"
                        ? selecionado
                          ? "font-semibold ring-2 ring-offset-1"
                          : "bg-muted/60 hover:bg-muted cursor-pointer font-medium"
                        : status === "lotado"
                          ? "cursor-not-allowed bg-red-500/10 text-red-600/60 line-through dark:text-red-400/60"
                          : "text-muted-foreground/30 cursor-not-allowed")
                    }
                  >
                    {data.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-muted inline-block size-3 rounded-sm" /> Disponível
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: corPrimaria }} /> Selecionado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-red-500/20" /> Sem vagas
              </span>
            </div>

            {mesSemDisponibilidade && primeiroDiaDisponivel !== null && (
              <div className="bg-muted/50 flex flex-col gap-2 rounded-md p-3 text-sm">
                <p>Não há datas com vagas em {nomeDoMes(mesAtual)}.</p>
                {!proximoMesDesabilitado && (
                  <Button type="button" variant="outline" size="sm" className="w-fit" onClick={irParaProximoMes}>
                    Ver o próximo mês
                  </Button>
                )}
              </div>
            )}

            {dataSelecionada && (
              <div className="flex flex-col gap-2">
                <Label>Horários disponíveis em {dataComDiaSemana(dataSelecionada)}</Label>
                {horariosDoDiaSelecionado.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum horário configurado para esse dia.</p>
                ) : horariosDoDiaSelecionado.every((h) => h.lotado) ? (
                  <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                    Todos os horários deste dia estão lotados. Escolha outra data.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {horariosDoDiaSelecionado.map(({ horario, lotado }) => {
                      const selecionado = horario === horarioSelecionado;
                      return (
                        <button
                          key={horario}
                          type="button"
                          disabled={lotado}
                          aria-pressed={selecionado}
                          onClick={() => {
                            setHorarioSelecionado(horario);
                            setErroHorario(null);
                          }}
                          style={selecionado ? { backgroundColor: corPrimaria, borderColor: corPrimaria, color: "#fff" } : undefined}
                          className={
                            "flex min-h-11 flex-col items-center justify-center rounded-md border px-4 py-1.5 text-sm transition-colors " +
                            (lotado
                              ? "text-muted-foreground/50 cursor-not-allowed"
                              : selecionado
                                ? "font-semibold"
                                : "hover:bg-muted cursor-pointer")
                          }
                        >
                          <span className={lotado ? "line-through" : undefined}>{horario}</span>
                          {lotado && <span className="text-[10px] leading-none text-red-600/80 dark:text-red-400/80">Lotado</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {dataSelecionada && horarioSelecionado && (
              <p className="rounded-md p-3 text-sm font-medium" style={{ backgroundColor: `${corPrimaria}1a`, color: corPrimaria }}>
                ✓ Selecionado: {resumoData} às {horarioSelecionado}
              </p>
            )}

            <Button
              type="button"
              disabled={!dataSelecionada || !horarioSelecionado}
              style={{ backgroundColor: corPrimaria }}
              onClick={() => {
                setTentouAvancar(false);
                setPasso(2);
              }}
            >
              Continuar
            </Button>
            {(!dataSelecionada || !horarioSelecionado) && (
              <p className="text-muted-foreground -mt-2 text-center text-xs">
                {!dataSelecionada ? "Selecione uma data para ver os horários." : "Selecione um horário para continuar."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {passo === 2 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm font-medium">2. Seus dados</p>

            <p className="bg-muted/50 rounded-md p-2.5 text-sm">
              📅 {resumoData} às {horarioSelecionado}
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                autoComplete="name"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                aria-invalid={tentouAvancar && !!errosPasso2.nome}
                aria-describedby={tentouAvancar && errosPasso2.nome ? "erro-nome" : undefined}
              />
              {tentouAvancar && errosPasso2.nome && (
                <p id="erro-nome" role="alert" className="text-destructive text-xs">
                  {errosPasso2.nome}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={whatsapp}
                onChange={(event) => setWhatsapp(formatarTelefone(event.target.value))}
                aria-invalid={tentouAvancar && !!errosPasso2.whatsapp}
                aria-describedby={tentouAvancar && errosPasso2.whatsapp ? "erro-whatsapp" : undefined}
              />
              {tentouAvancar && errosPasso2.whatsapp && (
                <p id="erro-whatsapp" role="alert" className="text-destructive text-xs">
                  {errosPasso2.whatsapp}
                </p>
              )}
            </div>

            {pagina.campos_extras.map((campo) => (
              <div key={campo.nome} className="flex flex-col gap-2">
                <Label htmlFor={`campo-${campo.nome}`}>{campo.nome}</Label>
                {campo.tipo === "select" ? (
                  <Select
                    items={Object.fromEntries((campo.opcoes ?? []).map((o) => [o, o]))}
                    value={camposExtras[campo.nome] ?? ""}
                    onValueChange={(v) => v && setCamposExtras((prev) => ({ ...prev, [campo.nome]: v }))}
                  >
                    <SelectTrigger id={`campo-${campo.nome}`} className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(campo.opcoes ?? []).map((opcao) => (
                        <SelectItem key={opcao} value={opcao}>
                          {opcao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`campo-${campo.nome}`}
                    value={camposExtras[campo.nome] ?? ""}
                    onChange={(event) => setCamposExtras((prev) => ({ ...prev, [campo.nome]: event.target.value }))}
                  />
                )}
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <Label htmlFor="mensagem">Mensagem ou observação (opcional)</Label>
              <Textarea
                id="mensagem"
                rows={3}
                maxLength={MENSAGEM_MAXIMO}
                placeholder="Quer deixar um recado? Escreva aqui."
                value={mensagem}
                onChange={(event) => setMensagem(event.target.value)}
              />
              <span className="text-muted-foreground self-end text-xs">
                {mensagem.length}/{MENSAGEM_MAXIMO}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={aceite}
                  onChange={(event) => setAceite(event.target.checked)}
                  className="mt-0.5 size-4"
                />
                Concordo em receber mensagens pelo WhatsApp sobre este agendamento.
              </label>
              {tentouAvancar && errosPasso2.aceite && (
                <p role="alert" className="text-destructive text-xs">
                  {errosPasso2.aceite}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setPasso(1)}>
                Voltar
              </Button>
              <Button type="button" className="flex-1" style={{ backgroundColor: corPrimaria }} onClick={avancarDoPasso2}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {passo === 3 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm font-medium">3. Confirmação</p>

            <div className="bg-muted/50 flex flex-col gap-1.5 rounded-md p-3 text-sm">
              <p>📋 {pagina.titulo}</p>
              <p>📅 {resumoData}</p>
              <p>⏰ {horarioSelecionado}</p>
              <p>👤 {nome}</p>
              <p>📱 {whatsapp}</p>
              {pagina.campos_extras
                .filter((campo) => camposExtras[campo.nome])
                .map((campo) => (
                  <p key={campo.nome}>
                    • {campo.nome}: {camposExtras[campo.nome]}
                  </p>
                ))}
              {mensagem.trim() && <p className="whitespace-pre-wrap">💬 {mensagem.trim()}</p>}
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <form action={handleSubmit} className="flex gap-2">
              <input type="hidden" name="nome" value={nome} />
              <input type="hidden" name="whatsapp" value={whatsapp} />
              <input type="hidden" name="aceite_whatsapp" value={aceite ? "on" : ""} />
              <Button type="button" variant="outline" onClick={() => setPasso(2)} disabled={isPending}>
                Voltar
              </Button>
              <Button type="submit" className="flex-1" style={{ backgroundColor: corPrimaria }} disabled={isPending}>
                {isPending ? "Confirmando..." : "Confirmar agendamento"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
