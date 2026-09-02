"use client";

import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Printer, X } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import {
  getRelatorioAcademico,
  type AlunoRelatorioAcademico,
  type RelatorioAcademico,
} from "@/app/admin/relatorios/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FREQUENCIA_MINIMA_PERCENTUAL, FREQUENCIA_STATUS_BADGE_CLASS } from "@/lib/presencas/schema";

export type TurmaOpcao = { id: string; nome: string; cursos: { nome: string } | null };

const STATUS_BADGE_CLASS: Record<AlunoRelatorioAcademico["status"], string> = {
  Aprovado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  Reprovado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  "Em andamento": "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

function formatDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Slug simples pro nome do arquivo exportado (sem acentos/espaços/símbolos)
// — não precisa de uma lib de slugify só pra isso. NFD separa a letra da
// marca de acento (combining diacritical mark, faixa ̀-ͯ), que o
// segundo replace então descarta.
const COMBINING_DIACRITICS_REGEX = /[̀-ͯ]/g;

function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 14, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  resumoRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  resumoCard: { flex: 1, borderWidth: 1, borderColor: "#dddddd", borderRadius: 4, padding: 8 },
  resumoLabel: { fontSize: 8, color: "#555555" },
  resumoValor: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingVertical: 4,
  },
  headerCell: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dddddd", paddingVertical: 4 },
  cell: { paddingHorizontal: 2 },
  footer: { marginTop: 16, fontSize: 9, fontFamily: "Helvetica-Bold" },
});

const COLUNAS = [
  { chave: "nome", label: "Aluno", width: "28%" },
  { chave: "presencas", label: "Presenças", width: "13%" },
  { chave: "faltas", label: "Faltas", width: "13%" },
  { chave: "percentual", label: "% Frequência", width: "15%" },
  { chave: "nota", label: "Nota Final", width: "13%" },
  { chave: "status", label: "Status", width: "18%" },
] as const;

function RelatorioAcademicoDocument({
  dados,
  dataInicio,
  dataFim,
  geradoEm,
}: {
  dados: RelatorioAcademico;
  dataInicio: string;
  dataFim: string;
  geradoEm: string;
}) {
  const total = dados.alunos.length;
  const mediaFrequencia =
    total > 0 ? Math.round(dados.alunos.reduce((soma, a) => soma + a.percentualFrequencia, 0) / total) : 0;
  const aprovados = dados.alunos.filter((a) => a.status === "Aprovado").length;
  const reprovados = dados.alunos.filter((a) => a.status === "Reprovado").length;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Relatório de Frequência</Text>
          <Text style={pdfStyles.subtitle}>
            {dados.turma.nome} — {dados.turma.curso}
          </Text>
          <Text style={pdfStyles.meta}>
            Período: {formatDataBR(dataInicio)} a {formatDataBR(dataFim)}
          </Text>
          <Text style={pdfStyles.meta}>Gerado em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.resumoRow}>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Total de Alunos</Text>
            <Text style={pdfStyles.resumoValor}>{total}</Text>
          </View>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Média de Frequência</Text>
            <Text style={pdfStyles.resumoValor}>{mediaFrequencia}%</Text>
          </View>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Aprovados</Text>
            <Text style={pdfStyles.resumoValor}>{aprovados}</Text>
          </View>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Reprovados</Text>
            <Text style={pdfStyles.resumoValor}>{reprovados}</Text>
          </View>
        </View>

        <View style={pdfStyles.headerRow}>
          {COLUNAS.map((coluna) => (
            <Text key={coluna.chave} style={[pdfStyles.cell, pdfStyles.headerCell, { width: coluna.width }]}>
              {coluna.label}
            </Text>
          ))}
        </View>

        {dados.alunos.map((aluno) => (
          <View key={aluno.matriculaId} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "28%" }]}>{aluno.nome}</Text>
            <Text style={[pdfStyles.cell, { width: "13%" }]}>{aluno.presencas}</Text>
            <Text style={[pdfStyles.cell, { width: "13%" }]}>{aluno.faltas}</Text>
            <Text style={[pdfStyles.cell, { width: "15%" }]}>{aluno.percentualFrequencia}%</Text>
            <Text style={[pdfStyles.cell, { width: "13%" }]}>{aluno.notaFinal ?? "—"}</Text>
            <Text style={[pdfStyles.cell, { width: "18%" }]}>{aluno.status}</Text>
          </View>
        ))}

        <Text style={pdfStyles.footer}>Mínimo para aprovação: 75% de frequência</Text>
      </Page>
    </Document>
  );
}

export function RelatorioAcademicoView({ turmas }: { turmas: TurmaOpcao[] }) {
  const [buscaTurma, setBuscaTurma] = useState("");
  const [turmaSelecionada, setTurmaSelecionada] = useState<TurmaOpcao | null>(null);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dados, setDados] = useState<RelatorioAcademico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  // Filtro client-side sobre as turmas já carregadas pelo Server Component
  // (mesma lista pequena de sempre — turmas ativas) — não precisa de uma
  // ida ao servidor pra isso, só de 2+ caracteres pra não listar tudo de
  // cara.
  const termoTurma = buscaTurma.trim().toLowerCase();
  const sugestoesTurma = useMemo(() => {
    if (termoTurma.length < 2) return [];
    return turmas
      .filter((turma) => {
        const nomeTurma = turma.nome.toLowerCase();
        const nomeCurso = (turma.cursos?.nome ?? "").toLowerCase();
        return nomeTurma.includes(termoTurma) || nomeCurso.includes(termoTurma);
      })
      .slice(0, 8);
  }, [turmas, termoTurma]);

  function handleSelecionarTurma(turma: TurmaOpcao) {
    setTurmaSelecionada(turma);
    setBuscaTurma("");
    setSugestoesAbertas(false);
  }

  function handleLimparTurma() {
    setTurmaSelecionada(null);
    setBuscaTurma("");
    setDados(null);
  }

  function handleGerar() {
    setError(null);
    if (!turmaSelecionada) {
      setError("Selecione uma turma.");
      return;
    }
    if (!dataInicio || !dataFim) {
      setError("Informe o período.");
      return;
    }
    startTransition(async () => {
      const resultado = await getRelatorioAcademico(turmaSelecionada.id, dataInicio, dataFim);
      if ("error" in resultado) {
        setError(resultado.error);
        setDados(null);
        return;
      }
      setDados(resultado.data);
    });
  }

  const resumo = useMemo(() => {
    if (!dados) return null;
    const total = dados.alunos.length;
    const mediaFrequencia =
      total > 0 ? Math.round(dados.alunos.reduce((soma, a) => soma + a.percentualFrequencia, 0) / total) : 0;
    const aprovados = dados.alunos.filter((a) => a.status === "Aprovado").length;
    const reprovados = dados.alunos.filter((a) => a.status === "Reprovado").length;
    return { total, mediaFrequencia, aprovados, reprovados };
  }, [dados]);

  async function handleExportarPdf() {
    if (!dados) return;
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <RelatorioAcademicoDocument dados={dados} dataInicio={dataInicio} dataFim={dataFim} geradoEm={geradoEm} />,
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

  async function handleExportarExcel() {
    if (!dados || !resumo) return;
    setExportandoExcel(true);
    try {
      const XLSX = await import("xlsx");

      const wsFrequencia = XLSX.utils.json_to_sheet(
        dados.alunos.map((aluno) => ({
          Aluno: aluno.nome,
          "E-mail": aluno.email,
          Presenças: aluno.presencas,
          Faltas: aluno.faltas,
          "% Frequência": aluno.percentualFrequencia,
          "Nota Final": aluno.notaFinal ?? "—",
          Status: aluno.status,
        })),
      );

      const wsResumo = XLSX.utils.json_to_sheet([
        { Indicador: "Total de alunos", Valor: resumo.total },
        { Indicador: "Média de frequência (%)", Valor: resumo.mediaFrequencia },
        { Indicador: "Aprovados", Valor: resumo.aprovados },
        { Indicador: "Reprovados", Valor: resumo.reprovados },
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsFrequencia, "Frequência");
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
      const dataArquivo = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `frequencia-${slugificar(dados.turma.nome)}-${dataArquivo}.xlsx`);
    } finally {
      setExportandoExcel(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="relative flex flex-col gap-2">
            <Label htmlFor="turma">Turma</Label>
            {turmaSelecionada ? (
              <Badge variant="secondary" className="flex w-fit items-center gap-1.5 py-1.5 pr-1.5 pl-2.5">
                {turmaSelecionada.nome} — {turmaSelecionada.cursos?.nome ?? "—"}
                <button
                  type="button"
                  onClick={handleLimparTurma}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                  aria-label="Limpar turma selecionada"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : (
              <Input
                id="turma"
                placeholder="Buscar turma..."
                className="w-64"
                value={buscaTurma}
                onChange={(event) => {
                  setBuscaTurma(event.target.value);
                  setSugestoesAbertas(true);
                }}
                onFocus={() => setSugestoesAbertas(true)}
                onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
              />
            )}

            {sugestoesAbertas && !turmaSelecionada && termoTurma.length >= 2 && (
              <div className="bg-popover absolute top-full left-0 z-10 mt-1 flex w-64 flex-col overflow-hidden rounded-md border shadow-md">
                {sugestoesTurma.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">Nenhuma turma encontrada.</p>
                ) : (
                  sugestoesTurma.map((turma) => (
                    <button
                      key={turma.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelecionarTurma(turma);
                      }}
                      className="hover:bg-muted flex flex-col gap-0.5 border-b p-2.5 text-left text-sm last:border-b-0"
                    >
                      <span className="font-medium">{turma.nome}</span>
                      <span className="text-muted-foreground text-xs">{turma.cursos?.nome ?? "—"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_inicio">Período de</Label>
            <Input
              id="data_inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_fim">Até</Label>
            <Input id="data_fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <Button onClick={handleGerar} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar Relatório"}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportarPdf}
            disabled={!dados || dados.alunos.length === 0 || gerandoPdf}
          >
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Exportar PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportarExcel}
            disabled={!dados || dados.alunos.length === 0 || exportandoExcel}
          >
            <FileSpreadsheet />
            {exportandoExcel ? "Exportando..." : "Exportar Excel"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {dados && resumo && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="gz-kpi gz-kpi-blue">
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Total de Alunos
                </span>
                <span className="gz-num text-[22px]" style={{ color: "#2196F3" }}>
                  {resumo.total}
                </span>
              </CardContent>
            </Card>
            <Card className={`gz-kpi ${resumo.mediaFrequencia >= FREQUENCIA_MINIMA_PERCENTUAL ? "gz-kpi-green" : "gz-kpi-red"}`}>
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Média de Frequência
                </span>
                <span
                  className="gz-num text-[22px]"
                  style={{ color: resumo.mediaFrequencia >= FREQUENCIA_MINIMA_PERCENTUAL ? "#2DD4A0" : "#FF5A5F" }}
                >
                  {resumo.mediaFrequencia}%
                </span>
              </CardContent>
            </Card>
            <Card className="gz-kpi gz-kpi-green">
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Aprovados
                </span>
                <span className="gz-num text-[22px]" style={{ color: "#2DD4A0" }}>
                  {resumo.aprovados}
                </span>
              </CardContent>
            </Card>
            <Card className="gz-kpi gz-kpi-red">
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Reprovados
                </span>
                <span className="gz-num text-[22px]" style={{ color: "#FF5A5F" }}>
                  {resumo.reprovados}
                </span>
              </CardContent>
            </Card>
          </div>

          {dados.alunos.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Nenhum aluno matriculado nessa turma.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Presenças</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>% Frequência</TableHead>
                  <TableHead>Nota Final</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.alunos.map((aluno) => (
                  <TableRow key={aluno.matriculaId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{aluno.nome}</span>
                        <span className="text-muted-foreground text-xs">{aluno.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{aluno.presencas}</TableCell>
                    <TableCell>{aluno.faltas}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          FREQUENCIA_STATUS_BADGE_CLASS[
                            aluno.percentualFrequencia >= FREQUENCIA_MINIMA_PERCENTUAL ? "apto" : "inapto"
                          ]
                        }
                      >
                        {aluno.percentualFrequencia}%
                      </Badge>
                    </TableCell>
                    <TableCell>{aluno.notaFinal ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE_CLASS[aluno.status]}>{aluno.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
