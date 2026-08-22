"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { updateMatriculaStatus } from "@/app/admin/alunos/matriculas-actions";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MATRICULA_STATUS_BADGE_CLASS,
  MATRICULA_STATUS_LABELS,
  type Matricula,
} from "@/lib/matriculas/schema";

export type MatriculaListItem = Matricula & {
  alunos: { full_name: string | null; email: string; cpf: string } | null;
  turmas: {
    nome: string;
    vagas_total: number;
    vagas_ocupadas: number;
    cursos: { nome: string } | null;
  } | null;
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...MATRICULA_STATUS_LABELS,
};

function formatValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatParcelas(numParcelas: number | null, valorParcela: number | null): string {
  if (!numParcelas || valorParcela === null) return "—";
  return `${numParcelas}x de ${formatValor(valorParcela)}`;
}

function formatDesconto(matricula: MatriculaListItem): string {
  if (
    matricula.desconto_tipo === "sem_bolsa" ||
    matricula.desconto_formato === null ||
    matricula.desconto_valor === null
  ) {
    return "—";
  }
  if (matricula.desconto_formato === "porcentagem") {
    return `${matricula.desconto_valor}%`;
  }
  return formatValor(matricula.desconto_valor);
}

// dd/mm/aaaa a partir de uma data "yyyy-mm-dd" (sem componente de hora) —
// evita o desvio de fuso de usar `new Date(...)` direto numa string de
// data pura, que o JS interpreta como UTC meia-noite.
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "21/08/2026 às 14:32" — mesmo formato usado em formatDataHora
// (src/lib/alunos/schema.ts); duplicado aqui em vez de importar de outro
// domínio, já que é só um formatador genérico de data.
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
  { chave: "aluno", label: "Aluno", width: "20%" },
  { chave: "curso", label: "Curso", width: "18%" },
  { chave: "turma", label: "Turma", width: "16%" },
  { chave: "valor", label: "Valor Final", width: "14%" },
  { chave: "parcelas", label: "Parcelas", width: "16%" },
  { chave: "status", label: "Status", width: "8%" },
  { chave: "data", label: "Data", width: "8%" },
] as const;

function MatriculasPdfDocument({
  matriculas,
  geradoEm,
}: {
  matriculas: MatriculaListItem[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Educação Profissional — Lista de Matrículas</Text>
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

        {matriculas.map((matricula) => (
          <View key={matricula.id} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "20%" }]}>
              {matricula.alunos?.full_name ?? "—"}
            </Text>
            <Text style={[pdfStyles.cell, { width: "18%" }]}>
              {matricula.turmas?.cursos?.nome ?? "—"}
            </Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>{matricula.turmas?.nome ?? "—"}</Text>
            <Text style={[pdfStyles.cell, { width: "14%" }]}>{formatValor(matricula.valor_final)}</Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>
              {formatParcelas(matricula.num_parcelas, matricula.valor_parcela)}
            </Text>
            <Text style={[pdfStyles.cell, { width: "8%" }]}>
              {MATRICULA_STATUS_LABELS[matricula.status]}
            </Text>
            <Text style={[pdfStyles.cell, { width: "8%" }]}>
              {formatDataBR(matricula.data_matricula)}
            </Text>
          </View>
        ))}

        <Text style={pdfStyles.footer}>Total: {matriculas.length} matrículas</Text>
      </Page>
    </Document>
  );
}

function CancelarMatriculaButton({ matricula }: { matricula: MatriculaListItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancelar() {
    startTransition(async () => {
      const result = await updateMatriculaStatus(matricula.id, matricula.aluno_id, "cancelada");
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={matricula.status === "cancelada"}
          >
            Cancelar
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar matrícula</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja cancelar a matrícula de &quot;
            {matricula.alunos?.full_name ?? matricula.alunos?.email}&quot; em &quot;
            {matricula.turmas?.nome}&quot;?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleCancelar}>
            {isPending ? "Cancelando..." : "Cancelar matrícula"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MatriculasTable({ matriculas }: { matriculas: MatriculaListItem[] }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Filtro client-side simples: a lista já vem inteira do Server Component
  // (sem paginação hoje), então não há necessidade de ida e volta ao
  // servidor só pra buscar por aluno/curso ou filtrar por status — os dois
  // filtros combinam entre si.
  const matriculasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return matriculas.filter((matricula) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && matricula.status !== statusFiltro) {
        return false;
      }
      if (!termo) return true;

      const nomeAluno = (matricula.alunos?.full_name ?? "").toLowerCase();
      const nomeCurso = (matricula.turmas?.cursos?.nome ?? "").toLowerCase();
      return nomeAluno.includes(termo) || nomeCurso.includes(termo);
    });
  }, [matriculas, busca, statusFiltro]);

  async function handleImprimir() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — navegadores bloqueiam window.open() chamado depois
    // de uma Promise resolver por não associarem mais o gesto do usuário.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <MatriculasPdfDocument matriculas={matriculasFiltradas} geradoEm={geradoEm} />,
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
            placeholder="Buscar por aluno ou curso..."
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
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImprimir} disabled={gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Imprimir Lista"}
          </Button>
          <Button render={<Link href="/admin/matriculas/nova" />} nativeButton={false}>
            <Plus />
            Nova Matrícula
          </Button>
        </div>
      </div>

      {matriculasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma matrícula encontrada com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Valor Final</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Parcelas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data matrícula</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matriculasFiltradas.map((matricula) => (
              <TableRow key={matricula.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{matricula.alunos?.full_name ?? "—"}</span>
                    <span className="text-muted-foreground text-xs">
                      {matricula.alunos?.email ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{matricula.turmas?.cursos?.nome ?? "—"}</TableCell>
                <TableCell>{matricula.turmas?.nome ?? "—"}</TableCell>
                <TableCell>{formatValor(matricula.valor_final)}</TableCell>
                <TableCell>{formatDesconto(matricula)}</TableCell>
                <TableCell>{formatParcelas(matricula.num_parcelas, matricula.valor_parcela)}</TableCell>
                <TableCell>
                  <Badge className={MATRICULA_STATUS_BADGE_CLASS[matricula.status]}>
                    {MATRICULA_STATUS_LABELS[matricula.status]}
                  </Badge>
                </TableCell>
                <TableCell>{formatDataBR(matricula.data_matricula)}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" disabled>
                    Ver
                  </Button>
                  <CancelarMatriculaButton matricula={matricula} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
