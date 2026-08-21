"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteAlunoButton } from "@/components/admin/delete-aluno-button";
import {
  calculateAge,
  formatCpf,
  formatDataHora,
  formatTelefone,
  isMinor,
  onlyDigits,
  STATUS_ALUNO_BADGE_CLASS,
  STATUS_ALUNO_LABELS,
  type AlunoWithRelations,
} from "@/lib/alunos/schema";

export type AlunoListItem = AlunoWithRelations & {
  matriculas: { status: string; turmas: { nome: string } | null }[];
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...STATUS_ALUNO_LABELS,
};

const FAIXA_FILTRO_TODAS = "todas";
const FAIXA_FILTRO_MAIOR = "maior";
const FAIXA_FILTRO_MENOR = "menor";
const FAIXA_FILTRO_ITEMS: Record<string, string> = {
  [FAIXA_FILTRO_TODAS]: "Todas as idades",
  [FAIXA_FILTRO_MAIOR]: "Maior de idade",
  [FAIXA_FILTRO_MENOR]: "Menor de idade",
};

function turmasAtivasLabel(aluno: AlunoListItem) {
  const nomes = aluno.matriculas
    .filter((matricula) => matricula.status === "ativa")
    .map((matricula) => matricula.turmas?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return nomes.length > 0 ? nomes.join(", ") : "—";
}

// yyyy-mm-dd no fuso de exibição (America/Sao_Paulo) — pra comparar com os
// inputs type="date" do filtro (que só têm data, sem hora/fuso) do mesmo
// jeito que a coluna "Cadastrado em" mostra a data pro admin.
function dataLocalISO(isoString: string): string {
  return new Date(isoString).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

const pdfStyles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  header: { marginBottom: 14 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#555555", marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingVertical: 4,
  },
  headerCell: { fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 4,
  },
  cell: { paddingHorizontal: 2 },
  footer: { marginTop: 12, fontSize: 9, fontFamily: "Helvetica-Bold" },
});

const PDF_COLUNAS = [
  { chave: "nome", label: "Nome", width: "16%" },
  { chave: "email", label: "E-mail", width: "18%" },
  { chave: "cpf", label: "CPF", width: "11%" },
  { chave: "telefone", label: "Telefone", width: "11%" },
  { chave: "status", label: "Status", width: "8%" },
  { chave: "idade", label: "Idade", width: "7%" },
  { chave: "turmas", label: "Turmas ativas", width: "15%" },
  { chave: "cadastro", label: "Cadastrado em", width: "14%" },
] as const;

function AlunosPdfDocument({ alunos, geradoEm }: { alunos: AlunoListItem[]; geradoEm: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Educação Profissional</Text>
          <Text style={pdfStyles.subtitle}>Lista de alunos — impresso em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.headerRow}>
          {PDF_COLUNAS.map((coluna) => (
            <Text key={coluna.chave} style={[pdfStyles.cell, pdfStyles.headerCell, { width: coluna.width }]}>
              {coluna.label}
            </Text>
          ))}
        </View>

        {alunos.map((aluno) => (
          <View key={aluno.id} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>{aluno.profiles?.full_name ?? "—"}</Text>
            <Text style={[pdfStyles.cell, { width: "18%" }]}>{aluno.email}</Text>
            <Text style={[pdfStyles.cell, { width: "11%" }]}>{formatCpf(aluno.cpf)}</Text>
            <Text style={[pdfStyles.cell, { width: "11%" }]}>{formatTelefone(aluno.telefone)}</Text>
            <Text style={[pdfStyles.cell, { width: "8%" }]}>{STATUS_ALUNO_LABELS[aluno.status_aluno]}</Text>
            <Text style={[pdfStyles.cell, { width: "7%" }]}>
              {aluno.data_nascimento ? `${calculateAge(aluno.data_nascimento)} anos` : "—"}
            </Text>
            <Text style={[pdfStyles.cell, { width: "15%" }]}>{turmasAtivasLabel(aluno)}</Text>
            <Text style={[pdfStyles.cell, { width: "14%" }]}>
              {aluno.created_at ? formatDataHora(aluno.created_at) : "—"}
            </Text>
          </View>
        ))}

        <Text style={pdfStyles.footer}>Total de alunos: {alunos.length}</Text>
      </Page>
    </Document>
  );
}

export function AlunosTable({ alunos }: { alunos: AlunoListItem[] }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [faixaFiltro, setFaixaFiltro] = useState<string>(FAIXA_FILTRO_TODAS);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Filtro client-side simples: a lista de alunos já vem inteira do
  // Server Component (sem paginação hoje), então não há necessidade de ida
  // e volta ao servidor só pra buscar/filtrar por nome, CPF, telefone,
  // status, faixa etária ou período de cadastro — todos combinam entre si.
  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigits = onlyDigits(busca);

    return alunos.filter((aluno) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && aluno.status_aluno !== statusFiltro) {
        return false;
      }

      if (faixaFiltro !== FAIXA_FILTRO_TODAS) {
        if (!aluno.data_nascimento) return false;
        const menor = isMinor(aluno.data_nascimento);
        if (faixaFiltro === FAIXA_FILTRO_MENOR && !menor) return false;
        if (faixaFiltro === FAIXA_FILTRO_MAIOR && menor) return false;
      }

      if (dataDe || dataAte) {
        if (!aluno.created_at) return false;
        const dataCadastro = dataLocalISO(aluno.created_at);
        if (dataDe && dataCadastro < dataDe) return false;
        if (dataAte && dataCadastro > dataAte) return false;
      }

      if (!termo) return true;

      const nome = (aluno.profiles?.full_name ?? "").toLowerCase();
      if (nome.includes(termo)) return true;
      if (termoDigits.length === 0) return false;
      return aluno.cpf.includes(termoDigits) || aluno.telefone.includes(termoDigits);
    });
  }, [alunos, busca, statusFiltro, faixaFiltro, dataDe, dataAte]);

  async function handleImprimir() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — navegadores bloqueiam window.open() chamado depois
    // de uma Promise resolver por não associarem mais o gesto do usuário.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <AlunosPdfDocument alunos={alunosFiltrados} geradoEm={geradoEm} />,
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {alunosFiltrados.length} aluno{alunosFiltrados.length === 1 ? "" : "s"} encontrado
          {alunosFiltrados.length === 1 ? "" : "s"}
        </p>
        <Button variant="outline" onClick={handleImprimir} disabled={gerandoPdf}>
          <Printer />
          {gerandoPdf ? "Gerando PDF..." : "Imprimir"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />

        <Select
          items={STATUS_FILTRO_ITEMS}
          value={statusFiltro}
          onValueChange={(value) => setStatusFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(STATUS_FILTRO_ITEMS).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_FILTRO_ITEMS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={FAIXA_FILTRO_ITEMS}
          value={faixaFiltro}
          onValueChange={(value) => setFaixaFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(FAIXA_FILTRO_ITEMS).map((faixa) => (
              <SelectItem key={faixa} value={faixa}>
                {FAIXA_FILTRO_ITEMS[faixa]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro_data_de" className="text-muted-foreground text-xs">
            De:
          </Label>
          <Input
            id="filtro_data_de"
            type="date"
            value={dataDe}
            onChange={(event) => setDataDe(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro_data_ate" className="text-muted-foreground text-xs">
            Até:
          </Label>
          <Input
            id="filtro_data_ate"
            type="date"
            value={dataAte}
            onChange={(event) => setDataAte(event.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {alunosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum aluno encontrado com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Turmas ativas</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alunosFiltrados.map((aluno) => (
              <TableRow key={aluno.id}>
                <TableCell className="font-medium">{aluno.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{aluno.email}</TableCell>
                <TableCell>{formatCpf(aluno.cpf)}</TableCell>
                <TableCell>{formatTelefone(aluno.telefone)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_ALUNO_BADGE_CLASS[aluno.status_aluno]}>
                    {STATUS_ALUNO_LABELS[aluno.status_aluno]}
                  </Badge>
                </TableCell>
                <TableCell>{turmasAtivasLabel(aluno)}</TableCell>
                <TableCell>
                  {aluno.data_nascimento ? (
                    <div className="flex flex-col gap-1">
                      <span>{calculateAge(aluno.data_nascimento)} anos</span>
                      {isMinor(aluno.data_nascimento) ? (
                        <Badge variant="secondary" className="w-fit">
                          Menor de idade
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit">
                          Maior de idade
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{aluno.created_at ? formatDataHora(aluno.created_at) : "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    render={<Link href={`/admin/alunos/${aluno.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <DeleteAlunoButton id={aluno.id} nome={aluno.profiles?.full_name ?? aluno.email} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
