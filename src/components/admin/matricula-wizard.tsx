"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCpf, formatTelefone, onlyDigits } from "@/lib/alunos/schema";
import { CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { DIA_SEMANA_LABELS, type DIAS_SEMANA } from "@/lib/turmas/schema";
import {
  DESCONTO_FORMATOS,
  DESCONTO_FORMATO_LABELS,
  DESCONTO_TIPOS,
  DESCONTO_TIPO_LABELS,
  FORMAS_PAGAMENTO,
  FORMA_PAGAMENTO_LABELS,
  MATRICULA_STATUS_LABELS,
  NUM_PARCELAS_OPTIONS,
  STATUS_INICIAL_MATRICULA,
  type DescontoFormato,
  type DescontoTipo,
  type FormaPagamento,
  type Matricula,
  type MatriculaWizardInput,
} from "@/lib/matriculas/schema";
import {
  createMatricula,
  type AlunoParaMatricula,
  type CursoParaMatricula,
  type TurmaParaMatricula,
} from "@/app/admin/matriculas/actions";

const ETAPAS = ["Aluno", "Curso e Turma", "Valores", "Datas", "Materiais", "Confirmação"] as const;

function formatValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatParcelas(numParcelas: number, valorParcela: number | null): string {
  if (valorParcela === null) return "—";
  return `${numParcelas}x de ${formatValor(valorParcela)}`;
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC).
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "21/08/2026 às 14:32" — mesmo formato usado nas outras telas do admin
// (alunos-table.tsx, cursos-table.tsx, matriculas-table.tsx), duplicado
// aqui pelo mesmo motivo: evitar acoplar domínios só por um formatador.
function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

function formatDiasSemana(dias: (typeof DIAS_SEMANA)[number][] | null | undefined): string {
  if (!dias || dias.length === 0) return "—";
  return dias.map((dia) => DIA_SEMANA_LABELS[dia]).join(", ");
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-start gap-1">
      {ETAPAS.map((nome, index) => {
        const numero = index + 1;
        const concluida = numero < currentStep;
        const atual = numero === currentStep;
        return (
          <div key={nome} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              {index > 0 && (
                <div className={cn("h-0.5 flex-1", concluida || atual ? "bg-primary" : "bg-border")} />
              )}
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  concluida
                    ? "border-primary bg-primary text-primary-foreground"
                    : atual
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {concluida ? <Check className="size-4" /> : numero}
              </div>
              {index < ETAPAS.length - 1 && (
                <div className={cn("h-0.5 flex-1", concluida ? "bg-primary" : "bg-border")} />
              )}
            </div>
            <span
              className={cn(
                "text-center text-xs",
                atual ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {nome}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// --- PDF do comprovante ---

type ResumoMatricula = {
  aluno: AlunoParaMatricula;
  curso: CursoParaMatricula;
  turma: TurmaParaMatricula;
  valorOriginal: number | null;
  descontoTipo: DescontoTipo;
  descontoFormato: DescontoFormato | null;
  descontoValor: number;
  valorFinal: number | null;
  numParcelas: number;
  valorParcela: number | null;
  formaPagamento: FormaPagamento;
  dataPrimeiraMensalidade: string;
  dataInicio: string;
  previsaoConclusao: string | null;
  apostilaEntregue: boolean;
  fardaEntregue: boolean;
  kitEntregue: boolean;
  observacoes: string;
};

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 18, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
    padding: 4,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: "40%", color: "#555555" },
  value: { width: "60%", fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 24, fontSize: 9, textAlign: "center", color: "#555555" },
});

function LinhaPdf({ label, value }: { label: string; value: string }) {
  return (
    <View style={pdfStyles.row}>
      <Text style={pdfStyles.label}>{label}</Text>
      <Text style={pdfStyles.value}>{value}</Text>
    </View>
  );
}

function ComprovanteDocument({ resumo, geradoEm }: { resumo: ResumoMatricula; geradoEm: string }) {
  const descontoTexto =
    resumo.descontoTipo === "sem_bolsa"
      ? "Sem desconto"
      : `${DESCONTO_TIPO_LABELS[resumo.descontoTipo]}${
          resumo.descontoFormato === "porcentagem"
            ? ` (${resumo.descontoValor}%)`
            : resumo.descontoFormato === "reais"
              ? ` (${formatValor(resumo.descontoValor)})`
              : ""
        }`;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Educação Profissional</Text>
          <Text style={pdfStyles.subtitle}>Comprovante de Matrícula</Text>
          <Text style={pdfStyles.meta}>Emitido em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Aluno</Text>
          <LinhaPdf label="Nome" value={resumo.aluno.full_name ?? "—"} />
          <LinhaPdf label="E-mail" value={resumo.aluno.email} />
          <LinhaPdf label="CPF" value={formatCpf(resumo.aluno.cpf)} />
          <LinhaPdf label="Telefone" value={formatTelefone(resumo.aluno.telefone)} />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Curso e Turma</Text>
          <LinhaPdf label="Curso" value={resumo.curso.nome} />
          <LinhaPdf label="Modalidade" value={CURSO_TIPO_LABELS[resumo.curso.tipo]} />
          <LinhaPdf
            label="Carga horária"
            value={resumo.curso.carga_horaria_horas ? `${resumo.curso.carga_horaria_horas}h` : "—"}
          />
          <LinhaPdf label="Turma" value={resumo.turma.nome} />
          <LinhaPdf label="Dias da semana" value={formatDiasSemana(resumo.turma.cadencia_dias_semana)} />
          <LinhaPdf label="Horário" value={resumo.turma.horario_aula ?? "—"} />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Financeiro</Text>
          <LinhaPdf label="Valor original" value={formatValor(resumo.valorOriginal)} />
          <LinhaPdf label="Desconto" value={descontoTexto} />
          <LinhaPdf label="Valor final" value={formatValor(resumo.valorFinal)} />
          <LinhaPdf label="Parcelamento" value={formatParcelas(resumo.numParcelas, resumo.valorParcela)} />
          <LinhaPdf label="Forma de pagamento" value={FORMA_PAGAMENTO_LABELS[resumo.formaPagamento]} />
          <LinhaPdf label="1ª mensalidade" value={formatDataBR(resumo.dataPrimeiraMensalidade)} />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Datas</Text>
          <LinhaPdf label="Início" value={formatDataBR(resumo.dataInicio)} />
          <LinhaPdf
            label="Previsão de conclusão"
            value={resumo.previsaoConclusao ? formatDataBR(resumo.previsaoConclusao) : "—"}
          />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Materiais entregues</Text>
          <LinhaPdf label="Apostila" value={resumo.apostilaEntregue ? "Sim" : "Não"} />
          <LinhaPdf label="Farda" value={resumo.fardaEntregue ? "Sim" : "Não"} />
          <LinhaPdf label="Kit" value={resumo.kitEntregue ? "Sim" : "Não"} />
        </View>

        {resumo.observacoes && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Observações</Text>
            <Text>{resumo.observacoes}</Text>
          </View>
        )}

        <Text style={pdfStyles.footer}>
          Este comprovante confirma a matrícula do aluno acima.
        </Text>
      </Page>
    </Document>
  );
}

// --- Wizard ---

export function MatriculaWizard({
  alunos,
  cursos,
}: {
  alunos: AlunoParaMatricula[];
  cursos: CursoParaMatricula[];
}) {
  const [step, setStep] = useState(1);

  // Etapa 1 — Aluno
  const [buscaAluno, setBuscaAluno] = useState("");
  const [aluno, setAluno] = useState<AlunoParaMatricula | null>(null);

  // Etapa 2 — Curso e turma
  const [curso, setCurso] = useState<CursoParaMatricula | null>(null);
  const [turma, setTurma] = useState<TurmaParaMatricula | null>(null);

  // Etapa 3 — Valores
  const [descontoTipo, setDescontoTipo] = useState<DescontoTipo>("sem_bolsa");
  const [descontoFormato, setDescontoFormato] = useState<DescontoFormato | null>(null);
  const [descontoValorInput, setDescontoValorInput] = useState("");
  const [numParcelas, setNumParcelas] = useState(1);
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);

  // Etapa 4 — Datas
  const [dataInicio, setDataInicio] = useState("");

  // Etapa 5 — Materiais
  const [apostilaEntregue, setApostilaEntregue] = useState(false);
  const [fardaEntregue, setFardaEntregue] = useState(false);
  const [kitEntregue, setKitEntregue] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  // Etapa 6 — Confirmação
  const [statusInicial, setStatusInicial] = useState<"ativa" | "inativa">("ativa");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [matriculaCriada, setMatriculaCriada] = useState<Matricula | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const valorOriginal = curso?.valor ?? null;
  const descontoValor = Number(descontoValorInput.replace(",", ".")) || 0;

  const valorFinal = useMemo(() => {
    if (valorOriginal === null) return null;
    if (descontoTipo === "sem_bolsa") return valorOriginal;
    if (descontoFormato === "porcentagem") return Math.max(0, valorOriginal * (1 - descontoValor / 100));
    if (descontoFormato === "reais") return Math.max(0, valorOriginal - descontoValor);
    return valorOriginal;
  }, [valorOriginal, descontoTipo, descontoFormato, descontoValor]);

  const valorParcela = useMemo(() => {
    if (valorFinal === null || numParcelas <= 0) return null;
    return valorFinal / numParcelas;
  }, [valorFinal, numParcelas]);

  // turmas.data_fim já é uma data concreta definida na criação da turma —
  // usada direto como previsão de conclusão. A "estimativa pela carga
  // horária" citada na especificação não tem regra de negócio definida e
  // data_fim nunca é nula no schema atual, então esse fallback nunca chega
  // a ser exercitado na prática.
  const previsaoConclusao = turma?.data_fim ?? null;

  function podeAvancar(): boolean {
    switch (step) {
      case 1:
        return aluno !== null;
      case 2:
        return curso !== null && turma !== null;
      case 3:
        return formaPagamento !== null && dataPrimeiraMensalidade !== "";
      case 4:
        return dataInicio !== "";
      default:
        return true;
    }
  }

  function handleProximo() {
    if (!podeAvancar()) return;
    setStep((atual) => Math.min(atual + 1, ETAPAS.length));
  }

  function handleVoltar() {
    setStep((atual) => Math.max(atual - 1, 1));
  }

  function resetWizard() {
    setStep(1);
    setBuscaAluno("");
    setAluno(null);
    setCurso(null);
    setTurma(null);
    setDescontoTipo("sem_bolsa");
    setDescontoFormato(null);
    setDescontoValorInput("");
    setNumParcelas(1);
    setDataPrimeiraMensalidade("");
    setFormaPagamento(null);
    setDataInicio("");
    setApostilaEntregue(false);
    setFardaEntregue(false);
    setKitEntregue(false);
    setObservacoes("");
    setStatusInicial("ativa");
    setErro(null);
    setMatriculaCriada(null);
  }

  function handleConfirmar() {
    if (!aluno || !curso || !turma || !formaPagamento) return;
    setErro(null);

    const input: MatriculaWizardInput = {
      aluno_id: aluno.id,
      turma_id: turma.id,
      valor_original: valorOriginal,
      desconto_tipo: descontoTipo,
      desconto_formato: descontoTipo === "sem_bolsa" ? null : descontoFormato,
      desconto_valor: descontoTipo === "sem_bolsa" ? null : descontoValor,
      valor_final: valorFinal,
      num_parcelas: numParcelas,
      valor_parcela: valorParcela,
      forma_pagamento: formaPagamento,
      data_primeira_mensalidade: dataPrimeiraMensalidade,
      data_inicio: dataInicio,
      previsao_conclusao: previsaoConclusao,
      farda_entregue: fardaEntregue,
      apostila_entregue: apostilaEntregue,
      kit_entregue: kitEntregue,
      observacoes: observacoes.trim() || undefined,
      status: statusInicial,
    };

    startTransition(async () => {
      const result = await createMatricula(input);
      if (result.success) {
        setMatriculaCriada(result.data);
      } else {
        setErro(result.error);
      }
    });
  }

  async function handleImprimirComprovante() {
    if (!aluno || !curso || !turma || !formaPagamento) return;

    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — mesmo padrão de alunos-table.tsx/cursos-table.tsx.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <ComprovanteDocument
          resumo={{
            aluno,
            curso,
            turma,
            valorOriginal,
            descontoTipo,
            descontoFormato,
            descontoValor,
            valorFinal,
            numParcelas,
            valorParcela,
            formaPagamento,
            dataPrimeiraMensalidade,
            dataInicio,
            previsaoConclusao,
            apostilaEntregue,
            fardaEntregue,
            kitEntregue,
            observacoes,
          }}
          geradoEm={geradoEm}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } finally {
      setGerandoPdf(false);
    }
  }

  function renderResumoCard() {
    if (!aluno || !curso || !turma || !formaPagamento) return null;

    return (
      <Card>
        <CardContent className="flex flex-col gap-4 py-4 text-sm">
          <div>
            <h3 className="mb-1 font-semibold">Aluno</h3>
            <p>{aluno.full_name ?? "—"}</p>
            <p className="text-muted-foreground">
              {aluno.email} · {formatCpf(aluno.cpf)} · {formatTelefone(aluno.telefone)}
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Curso e Turma</h3>
            <p>
              {curso.nome} — {turma.nome}
            </p>
            <p className="text-muted-foreground">
              {CURSO_TIPO_LABELS[curso.tipo]}
              {curso.carga_horaria_horas ? ` · ${curso.carga_horaria_horas}h` : ""} ·{" "}
              {formatDiasSemana(turma.cadencia_dias_semana)}
              {turma.horario_aula ? ` · ${turma.horario_aula}` : ""}
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Financeiro</h3>
            <p className="text-muted-foreground">Valor original: {formatValor(valorOriginal)}</p>
            {descontoTipo !== "sem_bolsa" && (
              <p className="text-muted-foreground">
                Desconto: {DESCONTO_TIPO_LABELS[descontoTipo]}
                {descontoFormato === "porcentagem"
                  ? ` (${descontoValor}%)`
                  : descontoFormato === "reais"
                    ? ` (${formatValor(descontoValor)})`
                    : ""}
              </p>
            )}
            <p className="text-muted-foreground">Valor final: {formatValor(valorFinal)}</p>
            <p className="text-muted-foreground">Parcelamento: {formatParcelas(numParcelas, valorParcela)}</p>
            <p className="text-muted-foreground">Pagamento: {FORMA_PAGAMENTO_LABELS[formaPagamento]}</p>
            <p className="text-muted-foreground">
              1ª mensalidade: {formatDataBR(dataPrimeiraMensalidade)}
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Datas</h3>
            <p className="text-muted-foreground">Início: {formatDataBR(dataInicio)}</p>
            <p className="text-muted-foreground">
              Previsão de conclusão: {previsaoConclusao ? formatDataBR(previsaoConclusao) : "—"}
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Materiais</h3>
            <p className="text-muted-foreground">
              Apostila: {apostilaEntregue ? "Sim" : "Não"} · Farda: {fardaEntregue ? "Sim" : "Não"} · Kit:{" "}
              {kitEntregue ? "Sim" : "Não"}
            </p>
          </div>
          {observacoes && (
            <div>
              <h3 className="mb-1 font-semibold">Observações</h3>
              <p className="text-muted-foreground">{observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderEtapaAluno() {
    const termo = buscaAluno.trim().toLowerCase();
    const termoDigits = onlyDigits(buscaAluno);
    const resultados = !termo
      ? alunos
      : alunos.filter((candidato) => {
          const nome = (candidato.full_name ?? "").toLowerCase();
          if (nome.includes(termo) || candidato.email.toLowerCase().includes(termo)) return true;
          if (termoDigits.length === 0) return false;
          return candidato.cpf.includes(termoDigits) || candidato.telefone.includes(termoDigits);
        });

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="busca_aluno">Buscar aluno</Label>
          <Input
            id="busca_aluno"
            placeholder="Nome, CPF ou e-mail..."
            value={buscaAluno}
            onChange={(event) => setBuscaAluno(event.target.value)}
          />
        </div>

        {aluno && (
          <Card className="border-primary">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex flex-col">
                <span className="font-medium">{aluno.full_name ?? "—"}</span>
                <span className="text-muted-foreground text-sm">{aluno.email}</span>
                <span className="text-muted-foreground text-sm">
                  CPF: {formatCpf(aluno.cpf)} · Tel: {formatTelefone(aluno.telefone)}
                </span>
              </div>
              <Badge>Selecionado</Badge>
            </CardContent>
          </Card>
        )}

        <div className="flex max-h-80 flex-col overflow-y-auto rounded-md border">
          {resultados.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              Nenhum aluno ativo encontrado.
            </p>
          ) : (
            resultados.map((candidato) => (
              <button
                key={candidato.id}
                type="button"
                onClick={() => setAluno(candidato)}
                className={cn(
                  "hover:bg-muted flex flex-col gap-0.5 border-b p-3 text-left text-sm last:border-b-0",
                  aluno?.id === candidato.id && "bg-muted",
                )}
              >
                <span className="font-medium">{candidato.full_name ?? "—"}</span>
                <span className="text-muted-foreground text-xs">
                  {candidato.email} · {formatCpf(candidato.cpf)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderEtapaCursoTurma() {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Curso e Turma</h2>
          <p className="text-muted-foreground text-xs">
            1. Selecione o curso&nbsp;&nbsp;→&nbsp;&nbsp;2. Selecione a turma disponível
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Curso</Label>
          <div className="flex flex-col rounded-md border">
            {cursos.map((candidato) => {
              const selecionado = curso?.id === candidato.id;
              return (
                <button
                  key={candidato.id}
                  type="button"
                  onClick={() => {
                    setCurso(candidato);
                    setTurma(null);
                  }}
                  className={cn(
                    "hover:bg-muted flex items-center justify-between gap-2 border-b border-l-4 border-l-transparent p-3 text-left text-sm last:border-b-0",
                    selecionado && "border-l-blue-500 bg-blue-500/10 hover:bg-blue-500/10",
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{candidato.nome}</span>
                    <span className="text-muted-foreground text-xs">
                      {CURSO_TIPO_LABELS[candidato.tipo]}
                      {candidato.carga_horaria_horas ? ` · ${candidato.carga_horaria_horas}h` : ""}
                      {candidato.valor !== null ? ` · ${formatValor(candidato.valor)}` : ""}
                    </span>
                  </div>
                  {selecionado && <Check className="size-4 shrink-0 text-blue-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {curso && (
          <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-2 duration-300">
            <Label>2. Agora selecione uma turma:</Label>
            {curso.turmas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma turma disponível para este curso no momento.
              </p>
            ) : (
              <div className="flex flex-col rounded-md border">
                {curso.turmas.map((candidata) => {
                  const vagasDisponiveis = candidata.vagas_total - candidata.vagas_ocupadas;
                  const semVagas = vagasDisponiveis <= 0;
                  const selecionada = turma?.id === candidata.id;
                  return (
                    <button
                      key={candidata.id}
                      type="button"
                      disabled={semVagas}
                      onClick={() => {
                        setTurma(candidata);
                        setDataInicio(candidata.data_inicio);
                      }}
                      className={cn(
                        "hover:bg-muted flex items-center justify-between gap-2 border-b border-l-4 border-l-transparent p-3 text-left text-sm last:border-b-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                        selecionada && "border-l-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/10",
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{candidata.nome}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDiasSemana(candidata.cadencia_dias_semana)}
                          {candidata.horario_aula ? ` · ${candidata.horario_aula}` : ""} ·{" "}
                          {semVagas ? "Sem vagas" : `${vagasDisponiveis} vaga(s) disponível(is)`}
                        </span>
                      </div>
                      {selecionada && <Check className="size-4 shrink-0 text-cyan-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!curso ? (
          <p className="text-muted-foreground text-sm">Selecione um curso para começar</p>
        ) : !turma ? (
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            ✓ Curso selecionado — agora escolha uma turma
          </p>
        ) : (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            ✓ Curso e turma selecionados — pode avançar!
          </p>
        )}

        {curso && turma && (
          <Card className="animate-in fade-in slide-in-from-top-2 border-primary duration-300">
            <CardContent className="flex flex-col gap-1 py-4 text-sm">
              <span className="font-medium">Você selecionou:</span>
              <span className="text-muted-foreground">
                📚 {curso.nome} — {CURSO_TIPO_LABELS[curso.tipo]}
                {curso.carga_horaria_horas ? ` · ${curso.carga_horaria_horas}h` : ""}
                {curso.valor !== null ? ` · ${formatValor(curso.valor)}` : ""}
              </span>
              <span className="text-muted-foreground">
                👥 {turma.nome} · {formatDiasSemana(turma.cadencia_dias_semana)}
                {turma.horario_aula ? ` · ${turma.horario_aula}` : ""} ·{" "}
                {turma.vagas_total - turma.vagas_ocupadas} vaga(s) disponível(is)
              </span>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderEtapaValores() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="valor_original">Valor Original</Label>
          <Input id="valor_original" readOnly value={formatValor(valorOriginal)} className="max-w-40" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="desconto_tipo">Tipo de Desconto</Label>
          <Select
            items={DESCONTO_TIPO_LABELS}
            value={descontoTipo}
            onValueChange={(value) => {
              setDescontoTipo(value as DescontoTipo);
              if (value === "sem_bolsa") {
                setDescontoFormato(null);
                setDescontoValorInput("");
              }
            }}
          >
            <SelectTrigger id="desconto_tipo" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESCONTO_TIPOS.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {DESCONTO_TIPO_LABELS[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {descontoTipo !== "sem_bolsa" && (
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex flex-col gap-2">
              <Label>Formato do desconto</Label>
              <RadioGroup
                value={descontoFormato ?? undefined}
                onValueChange={(value) => setDescontoFormato(value as DescontoFormato)}
                className="flex gap-4"
              >
                {DESCONTO_FORMATOS.map((formato) => (
                  <div key={formato} className="flex items-center gap-2">
                    <RadioGroupItem value={formato} id={`formato-${formato}`} />
                    <Label htmlFor={`formato-${formato}`} className="font-normal">
                      {DESCONTO_FORMATO_LABELS[formato]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="desconto_valor">
                Desconto{" "}
                {descontoFormato === "porcentagem" ? "(%)" : descontoFormato === "reais" ? "(R$)" : ""}
              </Label>
              <Input
                id="desconto_valor"
                type="number"
                min="0"
                step="0.01"
                value={descontoValorInput}
                onChange={(event) => setDescontoValorInput(event.target.value)}
                disabled={!descontoFormato}
                className="max-w-40"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="valor_final">Valor Final</Label>
          <Input id="valor_final" readOnly value={formatValor(valorFinal)} className="max-w-40" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="num_parcelas">Número de Parcelas</Label>
            <Select
              items={Object.fromEntries(NUM_PARCELAS_OPTIONS.map((n) => [String(n), `${n}x`]))}
              value={String(numParcelas)}
              onValueChange={(value) => setNumParcelas(Number(value))}
            >
              <SelectTrigger id="num_parcelas" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUM_PARCELAS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valor_parcela">Valor por Parcela</Label>
            <Input id="valor_parcela" readOnly value={formatValor(valorParcela)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_primeira_mensalidade">Data da Primeira Mensalidade</Label>
            <Input
              id="data_primeira_mensalidade"
              type="date"
              value={dataPrimeiraMensalidade}
              onChange={(event) => setDataPrimeiraMensalidade(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
            <Select
              items={FORMA_PAGAMENTO_LABELS}
              value={formaPagamento ?? undefined}
              onValueChange={(value) => setFormaPagamento(value as FormaPagamento)}
            >
              <SelectTrigger id="forma_pagamento" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((forma) => (
                  <SelectItem key={forma} value={forma}>
                    {FORMA_PAGAMENTO_LABELS[forma]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  function renderEtapaDatas() {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          As datas são baseadas na turma selecionada. Apenas a data de início pode ser ajustada.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_inicio">Data de Início</Label>
            <Input
              id="data_inicio"
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="previsao_conclusao">Previsão de Conclusão</Label>
            <Input
              id="previsao_conclusao"
              readOnly
              value={previsaoConclusao ? formatDataBR(previsaoConclusao) : "—"}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dias_semana">Dias da Semana</Label>
            <Input
              id="dias_semana"
              readOnly
              value={formatDiasSemana(turma?.cadencia_dias_semana ?? null)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="horario">Horário</Label>
            <Input id="horario" readOnly value={turma?.horario_aula ?? "—"} />
          </div>
        </div>
      </div>
    );
  }

  function renderEtapaMateriais() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="apostila_entregue"
            checked={apostilaEntregue}
            onCheckedChange={(checked) => setApostilaEntregue(checked === true)}
          />
          <Label htmlFor="apostila_entregue" className="font-normal">
            Apostila entregue
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="farda_entregue"
            checked={fardaEntregue}
            onCheckedChange={(checked) => setFardaEntregue(checked === true)}
          />
          <Label htmlFor="farda_entregue" className="font-normal">
            Farda entregue
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="kit_entregue"
            checked={kitEntregue}
            onCheckedChange={(checked) => setKitEntregue(checked === true)}
          />
          <Label htmlFor="kit_entregue" className="font-normal">
            Kit entregue
          </Label>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="observacoes">Observações adicionais</Label>
          <Textarea
            id="observacoes"
            rows={3}
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
    );
  }

  function renderEtapaConfirmacao() {
    if (!aluno || !curso || !turma || !formaPagamento) {
      return (
        <p className="text-destructive text-sm">Dados incompletos — volte às etapas anteriores.</p>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {renderResumoCard()}

        <div className="flex max-w-48 flex-col gap-2">
          <Label htmlFor="status_inicial">Status Inicial</Label>
          <Select
            items={{ ativa: MATRICULA_STATUS_LABELS.ativa, inativa: MATRICULA_STATUS_LABELS.inativa }}
            value={statusInicial}
            onValueChange={(value) => setStatusInicial(value as "ativa" | "inativa")}
          >
            <SelectTrigger id="status_inicial" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_INICIAL_MATRICULA.map((status) => (
                <SelectItem key={status} value={status}>
                  {MATRICULA_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
      </div>
    );
  }

  if (matriculaCriada && aluno && curso && turma) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Card className="border-primary">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Check className="text-primary size-10" />
            <h2 className="text-xl font-semibold">Matrícula realizada com sucesso!</h2>
            <p className="text-muted-foreground text-sm">
              {aluno.full_name ?? aluno.email} matriculado(a) em {curso.nome} — {turma.nome}.
            </p>
          </CardContent>
        </Card>

        {renderResumoCard()}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleImprimirComprovante} disabled={gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Imprimir Comprovante"}
          </Button>
          <Button type="button" variant="outline" onClick={resetWizard}>
            Nova Matrícula
          </Button>
          <Button render={<Link href="/admin/matriculas" />} nativeButton={false}>
            Ver todas as matrículas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <StepIndicator currentStep={step} />

      <Card>
        <CardContent className="py-6">
          {step === 1 && renderEtapaAluno()}
          {step === 2 && renderEtapaCursoTurma()}
          {step === 3 && renderEtapaValores()}
          {step === 4 && renderEtapaDatas()}
          {step === 5 && renderEtapaMateriais()}
          {step === 6 && renderEtapaConfirmacao()}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={handleVoltar} disabled={step === 1}>
          <ChevronLeft />
          Voltar
        </Button>
        {step < ETAPAS.length ? (
          <Button type="button" onClick={handleProximo} disabled={!podeAvancar()}>
            Próximo
            <ChevronRight />
          </Button>
        ) : (
          <Button type="button" onClick={handleConfirmar} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? "Confirmando..." : "Confirmar Matrícula"}
          </Button>
        )}
      </div>
    </div>
  );
}
