"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DeleteCursoButton } from "@/components/admin/delete-curso-button";
import {
  CURSO_STATUS_BADGE_CLASS,
  CURSO_STATUS_LABELS,
  CURSO_TIPO_LABELS,
  type Curso,
} from "@/lib/cursos/schema";

export type CursoListItem = Curso & {
  modulos: { aulas: { id: string }[] | null }[];
};

const MODALIDADE_FILTRO_TODAS = "todas";
const MODALIDADE_FILTRO_ITEMS: Record<string, string> = {
  [MODALIDADE_FILTRO_TODAS]: "Todas as modalidades",
  ...CURSO_TIPO_LABELS,
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...CURSO_STATUS_LABELS,
};

function contarAulas(curso: CursoListItem): number {
  return curso.modulos.reduce((total, modulo) => total + (modulo.aulas?.length ?? 0), 0);
}

function formatCargaHoraria(horas: number | null): string {
  return horas !== null ? `${horas}h` : "—";
}

function formatValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "21/08/2026 às 14:32" — mesmo formato usado em formatDataHora
// (src/lib/alunos/schema.ts); duplicado aqui em vez de importar do domínio
// de alunos, já que é só um formatador genérico de data sem relação com
// aluno nenhum.
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
  { chave: "nome", label: "Nome", width: "26%" },
  { chave: "modalidade", label: "Modalidade", width: "14%" },
  { chave: "carga", label: "Carga Horária", width: "15%" },
  { chave: "aulas", label: "Nº Aulas", width: "13%" },
  { chave: "valor", label: "Valor", width: "16%" },
  { chave: "status", label: "Status", width: "16%" },
] as const;

function CursosPdfDocument({ cursos, geradoEm }: { cursos: CursoListItem[]; geradoEm: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Educação Profissional</Text>
          <Text style={pdfStyles.subtitle}>Lista de cursos — impresso em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.headerRow}>
          {PDF_COLUNAS.map((coluna) => (
            <Text
              key={coluna.chave}
              style={[pdfStyles.cell, pdfStyles.headerCell, { width: coluna.width }]}
            >
              {coluna.label}
            </Text>
          ))}
        </View>

        {cursos.map((curso) => (
          <View key={curso.id} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "26%" }]}>{curso.nome}</Text>
            <Text style={[pdfStyles.cell, { width: "14%" }]}>{CURSO_TIPO_LABELS[curso.tipo]}</Text>
            <Text style={[pdfStyles.cell, { width: "15%" }]}>
              {formatCargaHoraria(curso.carga_horaria_horas)}
            </Text>
            <Text style={[pdfStyles.cell, { width: "13%" }]}>{contarAulas(curso)}</Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>{formatValor(curso.valor)}</Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>
              {CURSO_STATUS_LABELS[curso.status]}
            </Text>
          </View>
        ))}

        <Text style={pdfStyles.footer}>Total: {cursos.length} cursos</Text>
      </Page>
    </Document>
  );
}

export function CursosTable({ cursos }: { cursos: CursoListItem[] }) {
  const [busca, setBusca] = useState("");
  const [modalidadeFiltro, setModalidadeFiltro] = useState<string>(MODALIDADE_FILTRO_TODAS);
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Filtro client-side simples: a lista de cursos já vem inteira do Server
  // Component (sem paginação hoje), então não há necessidade de ida e volta
  // ao servidor só pra buscar por nome ou filtrar por modalidade/status —
  // os três filtros combinam entre si.
  const cursosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return cursos.filter((curso) => {
      if (modalidadeFiltro !== MODALIDADE_FILTRO_TODAS && curso.tipo !== modalidadeFiltro) {
        return false;
      }
      if (statusFiltro !== STATUS_FILTRO_TODOS && curso.status !== statusFiltro) {
        return false;
      }
      if (!termo) return true;
      return curso.nome.toLowerCase().includes(termo);
    });
  }, [cursos, busca, modalidadeFiltro, statusFiltro]);

  async function handleImprimir() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — navegadores bloqueiam window.open() chamado depois
    // de uma Promise resolver por não associarem mais o gesto do usuário.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <CursosPdfDocument cursos={cursosFiltrados} geradoEm={geradoEm} />,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="max-w-sm"
          />

          <Select
            items={MODALIDADE_FILTRO_ITEMS}
            value={modalidadeFiltro}
            onValueChange={(value) => setModalidadeFiltro(value as string)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(MODALIDADE_FILTRO_ITEMS).map((modalidade) => (
                <SelectItem key={modalidade} value={modalidade}>
                  {MODALIDADE_FILTRO_ITEMS[modalidade]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImprimir} disabled={gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Imprimir Lista"}
          </Button>
          <Button render={<Link href="/admin/cursos/novo" />} nativeButton={false}>
            <Plus />
            Novo Curso
          </Button>
        </div>
      </div>

      {cursosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum curso encontrado com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do Curso</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Carga Horária</TableHead>
              <TableHead>Nº Aulas</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cursosFiltrados.map((curso) => (
              <TableRow key={curso.id}>
                <TableCell className="font-medium">{curso.nome}</TableCell>
                <TableCell>{CURSO_TIPO_LABELS[curso.tipo]}</TableCell>
                <TableCell>{formatCargaHoraria(curso.carga_horaria_horas)}</TableCell>
                <TableCell>{contarAulas(curso)}</TableCell>
                <TableCell>{formatValor(curso.valor)}</TableCell>
                <TableCell>
                  <Badge className={CURSO_STATUS_BADGE_CLASS[curso.status]}>
                    {CURSO_STATUS_LABELS[curso.status]}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    render={<Link href={`/admin/cursos/${curso.id}/modulos`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Módulos
                  </Button>
                  <Button
                    render={<Link href={`/admin/cursos/${curso.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <DeleteCursoButton id={curso.id} nome={curso.nome} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
