"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { DeleteTurmaButton } from "@/components/admin/delete-turma-button";
import { DuplicarTurmaButton } from "@/components/admin/duplicar-turma-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
import { LIMITE_PADRAO } from "@/lib/paginacao";
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
import {
  TURMA_STATUS_BADGE_CLASS,
  TURMA_STATUS_LABELS,
  TURNO_BADGE_CLASS,
  TURNO_LABELS,
  type TurmaWithCurso,
} from "@/lib/turmas/schema";

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...TURMA_STATUS_LABELS,
};

const TURNO_FILTRO_TODOS = "todos";
const TURNO_FILTRO_ITEMS: Record<string, string> = {
  [TURNO_FILTRO_TODOS]: "Todos os turnos",
  ...TURNO_LABELS,
};

const ORDER_BY_ITEMS: Record<string, string> = {
  nome: "Nome (A-Z)",
  recente: "Mais recente",
  inicio: "Data de início",
};

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC),
// mesmo padrão usado em matriculas-table.tsx.
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
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

// horario_aula vem do banco como "time" (ex.: "19:00:00"); horario_fim é
// texto livre já salvo como "HH:MM" pelo próprio form (input type="time").
// O slice(0, 5) é inofensivo em ambos os casos — só corta os segundos
// quando existem.
function formatHorario(inicio: string | null, fim: string | null): string {
  const inicioFmt = inicio?.slice(0, 5);
  const fimFmt = fim?.slice(0, 5);
  if (!inicioFmt && !fimFmt) return "—";
  if (inicioFmt && fimFmt) return `${inicioFmt} - ${fimFmt}`;
  return inicioFmt ?? fimFmt ?? "—";
}

function formatVagas(turma: TurmaWithCurso): string {
  return `${turma.vagas_ocupadas}/${turma.capacidade_maxima}`;
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
  { chave: "turma", label: "Turma", width: "18%" },
  { chave: "curso", label: "Curso", width: "16%" },
  { chave: "professor", label: "Professor", width: "16%" },
  { chave: "turno", label: "Turno", width: "10%" },
  { chave: "periodo", label: "Período", width: "18%" },
  { chave: "vagas", label: "Vagas", width: "10%" },
  { chave: "status", label: "Status", width: "12%" },
] as const;

function TurmasPdfDocument({
  turmas,
  geradoEm,
}: {
  turmas: TurmaWithCurso[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Educação Profissional — Lista de Turmas</Text>
          <Text style={pdfStyles.subtitle}>Impresso em {geradoEm}</Text>
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

        {turmas.map((turma) => (
          <View key={turma.id} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "18%" }]}>{turma.nome}</Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>{turma.cursos?.nome ?? "—"}</Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>{turma.professor ?? "—"}</Text>
            <Text style={[pdfStyles.cell, { width: "10%" }]}>
              {turma.turno ? TURNO_LABELS[turma.turno] : "—"}
            </Text>
            <Text style={[pdfStyles.cell, { width: "18%" }]}>
              {formatDataBR(turma.data_inicio)} → {formatDataBR(turma.data_fim)}
            </Text>
            <Text style={[pdfStyles.cell, { width: "10%" }]}>{formatVagas(turma)}</Text>
            <Text style={[pdfStyles.cell, { width: "12%" }]}>
              {TURMA_STATUS_LABELS[turma.status]}
            </Text>
          </View>
        ))}

        <Text style={pdfStyles.footer}>Total: {turmas.length} turmas</Text>
      </Page>
    </Document>
  );
}

export function TurmasTable({
  turmas,
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
  orderBy,
}: {
  turmas: TurmaWithCurso[];
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
  orderBy: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [turnoFiltro, setTurnoFiltro] = useState<string>(TURNO_FILTRO_TODOS);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Mesma convenção de URL "limpa" de construirHref (paginacao.tsx): só
  // entra na URL o que difere do padrão. Volta pra página 1 ao trocar a
  // ordenação, preservando o limite atual.
  function handleOrderByChange(novoOrderBy: string) {
    const params = new URLSearchParams();
    if (novoOrderBy !== "nome") params.set("orderBy", novoOrderBy);
    if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
    const query = params.toString();
    router.push(query ? `/admin/turmas?${query}` : "/admin/turmas");
  }

  // Filtros client-side: a lista já vem inteira do Server Component (sem
  // paginação), mesmo padrão de matriculas-table.tsx — busca e os dois
  // selects combinam entre si.
  const turmasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return turmas.filter((turma) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && turma.status !== statusFiltro) return false;
      if (turnoFiltro !== TURNO_FILTRO_TODOS && turma.turno !== turnoFiltro) return false;
      if (!termo) return true;

      const nomeTurma = turma.nome.toLowerCase();
      const nomeCurso = (turma.cursos?.nome ?? "").toLowerCase();
      return nomeTurma.includes(termo) || nomeCurso.includes(termo);
    });
  }, [turmas, busca, statusFiltro, turnoFiltro]);

  async function handleImprimir() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — mesmo padrão de matriculas-table.tsx.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <TurmasPdfDocument turmas={turmasFiltradas} geradoEm={geradoEm} />,
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
            placeholder="Buscar por turma ou curso..."
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
            items={TURNO_FILTRO_ITEMS}
            value={turnoFiltro}
            onValueChange={(value) => setTurnoFiltro(value as string)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TURNO_FILTRO_ITEMS).map((turno) => (
                <SelectItem key={turno} value={turno}>
                  {TURNO_FILTRO_ITEMS[turno]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Ordenar por</Label>
            <Select
              items={ORDER_BY_ITEMS}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as string)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ORDER_BY_ITEMS).map((chave) => (
                  <SelectItem key={chave} value={chave}>
                    {ORDER_BY_ITEMS[chave]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImprimir} disabled={gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Imprimir Lista"}
          </Button>
          <Button render={<Link href="/admin/turmas/novo" />} nativeButton={false}>
            <Plus />
            Nova Turma
          </Button>
        </div>
      </div>

      {turmasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma turma encontrada com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Turma</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Professor</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Local/Sala</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Vagas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {turmasFiltradas.map((turma) => (
              <TableRow key={turma.id}>
                <TableCell className="font-medium">{turma.nome}</TableCell>
                <TableCell>{turma.cursos?.nome ?? "—"}</TableCell>
                <TableCell>{turma.professor ?? "—"}</TableCell>
                <TableCell>
                  {turma.turno ? (
                    <Badge className={TURNO_BADGE_CLASS[turma.turno]}>
                      {TURNO_LABELS[turma.turno]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{formatHorario(turma.horario_aula, turma.horario_fim)}</TableCell>
                <TableCell>{turma.local_sala ?? "—"}</TableCell>
                <TableCell>
                  {formatDataBR(turma.data_inicio)} → {formatDataBR(turma.data_fim)}
                </TableCell>
                <TableCell>{formatVagas(turma)}</TableCell>
                <TableCell>
                  <Badge className={TURMA_STATUS_BADGE_CLASS[turma.status]}>
                    {TURMA_STATUS_LABELS[turma.status]}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    render={<Link href={`/admin/turmas/${turma.id}`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Alunos
                  </Button>
                  <Button
                    render={<Link href={`/admin/turmas/${turma.id}/presencas`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Presenças
                  </Button>
                  <Button
                    render={<Link href={`/admin/turmas/${turma.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <DuplicarTurmaButton id={turma.id} nome={turma.nome} />
                  <DeleteTurmaButton id={turma.id} nome={turma.nome} />
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
        baseUrl="/admin/turmas"
        searchParams={orderBy !== "nome" ? { orderBy } : {}}
      />
    </div>
  );
}
