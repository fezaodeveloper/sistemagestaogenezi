"use client";

import { useState, useTransition } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { getRelatorioFinanceiro, type RelatorioFinanceiro } from "@/app/admin/relatorios/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GASTO_CATEGORIAS, GASTO_CATEGORIA_LABELS } from "@/lib/financeiro/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBRSimples(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
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

function percentualDoTotal(valor: number, total: number): number {
  return total > 0 ? Math.round((valor / total) * 1000) / 10 : 0;
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
  resumoValor: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  secao: { marginTop: 10 },
  secaoTitulo: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 3,
  },
});

function RelatorioFinanceiroDocument({
  dados,
  ano,
  mes,
  geradoEm,
}: {
  dados: RelatorioFinanceiro;
  ano: number;
  mes: number;
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Relatório Financeiro</Text>
          <Text style={pdfStyles.subtitle}>
            {NOMES_MES[mes - 1]} de {ano}
          </Text>
          <Text style={pdfStyles.meta}>Gerado em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.resumoRow}>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Total de Receitas</Text>
            <Text style={pdfStyles.resumoValor}>{formatValor(dados.receitas.total)}</Text>
          </View>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Total de Gastos</Text>
            <Text style={pdfStyles.resumoValor}>{formatValor(dados.gastos.total)}</Text>
          </View>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Saldo do Mês</Text>
            <Text style={pdfStyles.resumoValor}>{formatValor(dados.saldo)}</Text>
          </View>
          <View style={pdfStyles.resumoCard}>
            <Text style={pdfStyles.resumoLabel}>Taxa de Inadimplência</Text>
            <Text style={pdfStyles.resumoValor}>{dados.inadimplencia.taxaInadimplencia}%</Text>
          </View>
        </View>

        <View style={pdfStyles.secao}>
          <Text style={pdfStyles.secaoTitulo}>Receitas</Text>
          <View style={pdfStyles.linha}>
            <Text>Parcelas pagas</Text>
            <Text>{formatValor(dados.receitas.parcelas)}</Text>
          </View>
          <View style={pdfStyles.linha}>
            <Text>Pagamentos avulsos</Text>
            <Text>{formatValor(dados.receitas.avulsos)}</Text>
          </View>
        </View>

        <View style={pdfStyles.secao}>
          <Text style={pdfStyles.secaoTitulo}>Gastos por categoria</Text>
          {GASTO_CATEGORIAS.map((categoria) => (
            <View key={categoria} style={pdfStyles.linha}>
              <Text>{GASTO_CATEGORIA_LABELS[categoria]}</Text>
              <Text>
                {formatValor(dados.gastos.porCategoria[categoria] ?? 0)} (
                {percentualDoTotal(dados.gastos.porCategoria[categoria] ?? 0, dados.gastos.total)}%)
              </Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.secao}>
          <Text style={pdfStyles.secaoTitulo}>Inadimplência</Text>
          <View style={pdfStyles.linha}>
            <Text>Valor total atrasado</Text>
            <Text>{formatValor(dados.inadimplencia.valorAtrasado)}</Text>
          </View>
          <View style={pdfStyles.linha}>
            <Text>Parcelas atrasadas</Text>
            <Text>{dados.inadimplencia.quantidadeAtrasadas}</Text>
          </View>
          <View style={pdfStyles.linha}>
            <Text>Taxa de inadimplência</Text>
            <Text>{dados.inadimplencia.taxaInadimplencia}%</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function RelatorioFinanceiroView() {
  const hoje = new Date();
  const mesAnoAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const [mesAno, setMesAno] = useState(mesAnoAtual);
  const [dados, setDados] = useState<RelatorioFinanceiro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  const [anoSelecionado, mesSelecionado] = mesAno.split("-").map(Number);

  function handleGerar() {
    setError(null);
    if (!mesAno) {
      setError("Selecione o mês/ano.");
      return;
    }
    startTransition(async () => {
      const resultado = await getRelatorioFinanceiro(anoSelecionado, mesSelecionado);
      if ("error" in resultado) {
        setError(resultado.error);
        setDados(null);
        return;
      }
      setDados(resultado.data);
    });
  }

  async function handleExportarPdf() {
    if (!dados) return;
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <RelatorioFinanceiroDocument
          dados={dados}
          ano={anoSelecionado}
          mes={mesSelecionado}
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

  async function handleExportarExcel() {
    if (!dados) return;
    setExportandoExcel(true);
    try {
      const XLSX = await import("xlsx");

      const wsResumo = XLSX.utils.json_to_sheet([
        { Indicador: "Total de receitas", Valor: dados.receitas.total },
        { Indicador: "Receita — parcelas", Valor: dados.receitas.parcelas },
        { Indicador: "Receita — avulsos", Valor: dados.receitas.avulsos },
        { Indicador: "Total de gastos", Valor: dados.gastos.total },
        { Indicador: "Saldo do mês", Valor: dados.saldo },
        { Indicador: "Valor em atraso", Valor: dados.inadimplencia.valorAtrasado },
        { Indicador: "Parcelas atrasadas", Valor: dados.inadimplencia.quantidadeAtrasadas },
        { Indicador: "Taxa de inadimplência (%)", Valor: dados.inadimplencia.taxaInadimplencia },
      ]);

      const wsParcelas = XLSX.utils.json_to_sheet(
        dados.parcelas.map((parcela) => ({
          Aluno: parcela.aluno,
          Valor: parcela.valor,
          Vencimento: formatDataBRSimples(parcela.dataVencimento),
          Pagamento: parcela.dataPagamento ? formatDataBRSimples(parcela.dataPagamento) : "—",
          Status: parcela.status,
          "Forma de pagamento": parcela.formaPagamento ?? "—",
        })),
      );

      const wsGastos = XLSX.utils.json_to_sheet(
        GASTO_CATEGORIAS.map((categoria) => ({
          Categoria: GASTO_CATEGORIA_LABELS[categoria],
          Valor: dados.gastos.porCategoria[categoria] ?? 0,
        })),
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
      XLSX.utils.book_append_sheet(wb, wsParcelas, "Parcelas");
      XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
      XLSX.writeFile(wb, `relatorio-financeiro-${String(mesSelecionado).padStart(2, "0")}-${anoSelecionado}.xlsx`);
    } finally {
      setExportandoExcel(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mes_ano">Mês/Ano</Label>
            <Input
              id="mes_ano"
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={handleGerar} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar Relatório"}
          </Button>
          <Button variant="outline" onClick={handleExportarPdf} disabled={!dados || gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Exportar PDF"}
          </Button>
          <Button variant="outline" onClick={handleExportarExcel} disabled={!dados || exportandoExcel}>
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

      {dados && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="gz-kpi gz-kpi-green">
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Total de Receitas
                </span>
                <span className="gz-num text-[22px]" style={{ color: "#2DD4A0" }}>
                  {formatValor(dados.receitas.total)}
                </span>
              </CardContent>
            </Card>
            <Card className="gz-kpi gz-kpi-red">
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Total de Gastos
                </span>
                <span className="gz-num text-[22px]" style={{ color: "#FF5A5F" }}>
                  {formatValor(dados.gastos.total)}
                </span>
              </CardContent>
            </Card>
            <Card className={`gz-kpi ${dados.saldo >= 0 ? "gz-kpi-green" : "gz-kpi-red"}`}>
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Saldo do Mês
                </span>
                <span className="gz-num text-[22px]" style={{ color: dados.saldo >= 0 ? "#2DD4A0" : "#FF5A5F" }}>
                  {formatValor(dados.saldo)}
                </span>
              </CardContent>
            </Card>
            <Card className="gz-kpi gz-kpi-red">
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  Taxa de Inadimplência
                </span>
                <span className="gz-num text-[22px]" style={{ color: "#FF5A5F" }}>
                  {dados.inadimplencia.taxaInadimplencia}%
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Receitas</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Parcelas pagas</span>
                  <span className="font-medium">{formatValor(dados.receitas.parcelas)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pagamentos avulsos</span>
                  <span className="font-medium">{formatValor(dados.receitas.avulsos)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inadimplência</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor total atrasado</span>
                  <span className="font-medium">{formatValor(dados.inadimplencia.valorAtrasado)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Parcelas atrasadas</span>
                  <span className="font-medium">{dados.inadimplencia.quantidadeAtrasadas}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de inadimplência</span>
                  <span className="font-medium">{dados.inadimplencia.taxaInadimplencia}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gastos por categoria</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {GASTO_CATEGORIAS.map((categoria) => {
                const valor = dados.gastos.porCategoria[categoria] ?? 0;
                return (
                  <div key={categoria} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{GASTO_CATEGORIA_LABELS[categoria]}</span>
                    <span className="font-medium">
                      {formatValor(valor)}{" "}
                      <span className="text-muted-foreground text-xs">
                        ({percentualDoTotal(valor, dados.gastos.total)}%)
                      </span>
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
