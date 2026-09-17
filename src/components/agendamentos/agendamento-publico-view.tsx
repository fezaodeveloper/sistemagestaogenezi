"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { criarAgendamentoPublico } from "@/app/agendar/[slug]/actions";
import type { AgendamentoPagina } from "@/lib/agendamentos/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DIAS_SEMANA_CURTO = ["D", "S", "T", "Q", "Q", "S", "S"];

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

export function AgendamentoPublicoView({
  pagina,
  contagemPorHorario,
}: {
  pagina: AgendamentoPagina;
  contagemPorHorario: Record<string, number>;
}) {
  const hoje = useMemo(() => new Date(), []);
  const [mesAtual, setMesAtual] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [camposExtras, setCamposExtras] = useState<Record<string, string>>({});
  const [aceite, setAceite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const corPrimaria = pagina.cor_primaria;
  const style = { "--cor-primaria": corPrimaria } as CSSProperties;

  const dataMinimaISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + pagina.dias_antecedencia_minimo);
    return toISO(d);
  }, [pagina.dias_antecedencia_minimo]);

  const diasComHorario = useMemo(
    () => new Set(pagina.horarios_disponiveis.map((h) => h.dia_semana)),
    [pagina.horarios_disponiveis],
  );

  function diaHabilitado(data: Date): boolean {
    const iso = toISO(data);
    if (!diasComHorario.has(data.getDay())) return false;
    if (iso < dataMinimaISO) return false;
    if (pagina.data_inicio && iso < pagina.data_inicio) return false;
    if (pagina.data_fim && iso > pagina.data_fim) return false;
    return true;
  }

  const horariosDoDiaSelecionado = useMemo(() => {
    if (!dataSelecionada) return [];
    const diaSemana = new Date(`${dataSelecionada}T00:00:00`).getDay();
    return pagina.horarios_disponiveis
      .filter((h) => h.dia_semana === diaSemana)
      .sort((a, b) => a.horario.localeCompare(b.horario))
      .map((h) => ({
        horario: h.horario,
        lotado: (contagemPorHorario[`${dataSelecionada}_${h.horario}`] ?? 0) >= pagina.vagas_por_horario,
      }));
  }, [dataSelecionada, pagina.horarios_disponiveis, pagina.vagas_por_horario, contagemPorHorario]);

  const mesAnteriorDesabilitado = mesAtual.getFullYear() === hoje.getFullYear() && mesAtual.getMonth() === hoje.getMonth();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("data_agendada", dataSelecionada ?? "");
    formData.set("horario", horarioSelecionado ?? "");
    formData.set("campos_extras", JSON.stringify(camposExtras));

    startTransition(async () => {
      const resultado = await criarAgendamentoPublico(pagina.slug, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setSucesso(true);
    });
  }

  if (sucesso) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-lg font-medium">✅ Agendamento confirmado!</p>
          <p className="text-muted-foreground text-sm">
            {pagina.mensagem_confirmacao ??
              `Você agendou para ${dataSelecionada?.split("-").reverse().join("/")} às ${horarioSelecionado}. Em breve entraremos em contato pelo WhatsApp.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={style} className="flex flex-col gap-4">
      {passo === 1 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm font-medium">1. Escolha uma data e horário</p>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={mesAnteriorDesabilitado}
                onClick={() => setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium">
                {mesAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
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
                const habilitado = diaHabilitado(data);
                const selecionado = iso === dataSelecionada;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!habilitado}
                    onClick={() => {
                      setDataSelecionada(iso);
                      setHorarioSelecionado(null);
                    }}
                    style={selecionado ? { backgroundColor: corPrimaria, color: "#fff" } : undefined}
                    className={
                      "flex aspect-square items-center justify-center rounded-md text-sm transition-colors " +
                      (habilitado
                        ? selecionado
                          ? ""
                          : "hover:bg-muted cursor-pointer"
                        : "text-muted-foreground/30 cursor-not-allowed")
                    }
                  >
                    {data.getDate()}
                  </button>
                );
              })}
            </div>

            {dataSelecionada && (
              <div className="flex flex-col gap-2">
                <Label>Horários disponíveis</Label>
                {horariosDoDiaSelecionado.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum horário configurado para esse dia.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {horariosDoDiaSelecionado.map(({ horario, lotado }) => {
                      const selecionado = horario === horarioSelecionado;
                      return (
                        <button
                          key={horario}
                          type="button"
                          disabled={lotado}
                          onClick={() => setHorarioSelecionado(horario)}
                          style={selecionado ? { backgroundColor: corPrimaria, borderColor: corPrimaria, color: "#fff" } : undefined}
                          className={
                            "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                            (lotado
                              ? "text-muted-foreground/40 cursor-not-allowed line-through"
                              : selecionado
                                ? ""
                                : "hover:bg-muted cursor-pointer")
                          }
                        >
                          {horario}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              disabled={!dataSelecionada || !horarioSelecionado}
              style={{ backgroundColor: corPrimaria }}
              onClick={() => setPasso(2)}
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {passo === 2 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm font-medium">2. Seus dados</p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={nome} onChange={(event) => setNome(event.target.value)} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                required
              />
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

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(event) => setAceite(event.target.checked)}
                className="mt-0.5"
              />
              Concordo em receber mensagens pelo WhatsApp sobre este agendamento.
            </label>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setPasso(1)}>
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!nome.trim() || !whatsapp.trim() || !aceite}
                style={{ backgroundColor: corPrimaria }}
                onClick={() => setPasso(3)}
              >
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

            <div className="bg-muted/50 flex flex-col gap-1 rounded-md p-3 text-sm">
              <p>
                📅 {dataSelecionada?.split("-").reverse().join("/")} às {horarioSelecionado}
              </p>
              <p>👤 {nome}</p>
              <p>📱 {whatsapp}</p>
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
