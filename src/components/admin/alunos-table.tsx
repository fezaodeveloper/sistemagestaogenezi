"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
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
  indiceEvasao: number | null;
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

const RISCO_FILTRO_TODOS = "todos";
const RISCO_FILTRO_BAIXO = "baixo";
const RISCO_FILTRO_MEDIO = "medio";
const RISCO_FILTRO_ALTO = "alto";
const RISCO_FILTRO_ITEMS: Record<string, string> = {
  [RISCO_FILTRO_TODOS]: "Todos os riscos",
  [RISCO_FILTRO_BAIXO]: "Baixo (< 40)",
  [RISCO_FILTRO_MEDIO]: "Médio (40-69)",
  [RISCO_FILTRO_ALTO]: "Alto (≥ 70)",
};

function RiscoEvasaoBadge({ indice }: { indice: number | null }) {
  if (indice === null) return <span className="text-muted-foreground">—</span>;

  if (indice >= 70) {
    return (
      <Badge className="flex w-fit items-center gap-1 bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">
        <AlertTriangle className="size-3" />
        Alto
      </Badge>
    );
  }
  if (indice >= 40) {
    return (
      <Badge className="w-fit bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        Médio
      </Badge>
    );
  }
  return (
    <Badge className="w-fit bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
      Baixo
    </Badge>
  );
}

// AlunoAvatar (components/gamificacao/aluno-avatar.tsx) não serve aqui: é
// o avatar ilustrado que o próprio aluno escolhe de um catálogo fixo
// (raposa, coruja etc.), não um "foto ou iniciais" genérico — por isso um
// componente local, só pra essa tabela.
const AVATAR_CORES = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-violet-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
];

function corPorId(id: string): string {
  const soma = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_CORES[soma % AVATAR_CORES.length];
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function AlunoFotoAvatar({ aluno }: { aluno: AlunoListItem }) {
  const nome = aluno.profiles?.full_name ?? aluno.email;

  if (aluno.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
      <img src={aluno.foto_url} alt={nome} className="size-8 shrink-0 rounded-full object-cover" />
    );
  }

  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${corPorId(aluno.id)}`}
    >
      {iniciais(nome)}
    </span>
  );
}

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

export function AlunosTable({
  alunos,
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
}: {
  alunos: AlunoListItem[];
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
}) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [faixaFiltro, setFaixaFiltro] = useState<string>(FAIXA_FILTRO_TODAS);
  const [riscoFiltro, setRiscoFiltro] = useState<string>(RISCO_FILTRO_TODOS);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

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

      if (riscoFiltro !== RISCO_FILTRO_TODOS) {
        if (aluno.indiceEvasao === null) return false;
        if (riscoFiltro === RISCO_FILTRO_BAIXO && aluno.indiceEvasao >= 40) return false;
        if (riscoFiltro === RISCO_FILTRO_MEDIO && (aluno.indiceEvasao < 40 || aluno.indiceEvasao >= 70)) return false;
        if (riscoFiltro === RISCO_FILTRO_ALTO && aluno.indiceEvasao < 70) return false;
      }

      if (!termo) return true;

      const nome = (aluno.profiles?.full_name ?? "").toLowerCase();
      if (nome.includes(termo)) return true;
      if (termoDigits.length === 0) return false;
      return aluno.cpf.includes(termoDigits) || aluno.telefone.includes(termoDigits);
    });
  }, [alunos, busca, statusFiltro, faixaFiltro, riscoFiltro, dataDe, dataAte]);

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

  // Import dinâmico: xlsx só é carregado quando o admin realmente exporta,
  // não no bundle inicial da página — a biblioteca é usada só aqui.
  async function handleExportarExcel() {
    setExportandoExcel(true);
    try {
      const XLSX = await import("xlsx");
      const linhas = alunosFiltrados.map((aluno) => ({
        Nome: aluno.profiles?.full_name ?? "—",
        "E-mail": aluno.email,
        CPF: formatCpf(aluno.cpf),
        Telefone: formatTelefone(aluno.telefone),
        Status: STATUS_ALUNO_LABELS[aluno.status_aluno],
        "Turmas ativas": turmasAtivasLabel(aluno),
        Idade: aluno.data_nascimento ? calculateAge(aluno.data_nascimento) : "—",
        "Cadastrado em": aluno.created_at ? formatDataHora(aluno.created_at) : "—",
      }));
      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Alunos");
      XLSX.writeFile(wb, `alunos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExportandoExcel(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {alunosFiltrados.length} aluno{alunosFiltrados.length === 1 ? "" : "s"} encontrado
          {alunosFiltrados.length === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportarExcel} disabled={exportandoExcel}>
            <FileSpreadsheet />
            {exportandoExcel ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button variant="outline" onClick={handleImprimir} disabled={gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Imprimir página atual"}
          </Button>
        </div>
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

        <Select
          items={RISCO_FILTRO_ITEMS}
          value={riscoFiltro}
          onValueChange={(value) => setRiscoFiltro(value as string)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(RISCO_FILTRO_ITEMS).map((risco) => (
              <SelectItem key={risco} value={risco}>
                {RISCO_FILTRO_ITEMS[risco]}
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

      <p className="text-muted-foreground text-xs">
        Filtros aplicados apenas na página atual. Use a busca para encontrar registros específicos.
      </p>

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
              <TableHead>Risco</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alunosFiltrados.map((aluno) => (
              <TableRow key={aluno.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <AlunoFotoAvatar aluno={aluno} />
                    {aluno.profiles?.full_name ?? "—"}
                  </div>
                </TableCell>
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
                <TableCell>
                  <RiscoEvasaoBadge indice={aluno.indiceEvasao} />
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

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/alunos"
      />
    </div>
  );
}
