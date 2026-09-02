"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { updateMatriculaStatus } from "@/app/admin/alunos/matriculas-actions";
import { alterarStatusEmLote, downloadContrato } from "@/app/admin/matriculas/actions";
import { WhatsappStubDropdown } from "@/components/admin/whatsapp-stub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import type { ContratoStatus } from "@/lib/contratos/schema";

export type MatriculaListItem = Matricula & {
  alunos: { full_name: string | null; email: string; cpf: string } | null;
  turmas: {
    nome: string;
    vagas_total: number;
    vagas_ocupadas: number;
    cursos: { nome: string } | null;
  } | null;
  contratos_assinados: { status: ContratoStatus; aceito_em: string | null }[] | null;
};

// Âmbar (pendente) / verde (assinado) / cinza (recusado) — pedido
// explícito da tarefa. "Sem contrato" (matrícula sem linha em
// contratos_assinados) usa esse mesmo cinza, mas nunca fica sem botão
// nenhum: antes o botão sumia inteiramente nesse caso, o que só parecia
// um bug ("o botão não aparece") em vez de um estado válido.
const CONTRATO_STATUS_CONFIG: Record<ContratoStatus, { label: string; className: string }> = {
  pendente: {
    label: "⏳ Aguardando assinatura",
    className: "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300",
  },
  aceito: {
    label: "✓ Contrato assinado",
    className: "text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300",
  },
  recusado: {
    label: "Contrato recusado",
    className: "text-muted-foreground hover:text-foreground",
  },
};

function ContratoButton({ matricula }: { matricula: MatriculaListItem }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const contrato = matricula.contratos_assinados?.[0] ?? null;

  async function handleBaixar() {
    setErro(null);
    setBaixando(true);
    try {
      const resultado = await downloadContrato(matricula.id);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      const byteCharacters = atob(resultado.pdf);
      const byteNumbers = Array.from(byteCharacters, (caractere) => caractere.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob), "_blank");
    } finally {
      setBaixando(false);
    }
  }

  // Matrícula anterior ao sistema de contratos, ou a geração best-effort
  // em createMatricula falhou — nada pra baixar, mas o botão continua
  // visível (cinza, desabilitado) em vez de sumir da linha.
  if (!contrato) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled className="text-muted-foreground">
        Sem contrato
      </Button>
    );
  }

  const config = CONTRATO_STATUS_CONFIG[contrato.status];

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleBaixar}
        disabled={baixando}
        title={contrato.aceito_em ? `Assinado em ${formatDataHora(contrato.aceito_em)}` : undefined}
        className={config.className}
      >
        {baixando ? "Baixando..." : config.label}
      </Button>
      {erro && <span className="text-destructive text-xs">{erro}</span>}
    </div>
  );
}

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...MATRICULA_STATUS_LABELS,
};

// Só os 4 status oferecidos pra alteração em lote, pedido explícito da
// tarefa — "transferida" é um alias legado (ver matriculas/schema.ts),
// não aparece aqui pelo mesmo motivo que já não aparece em
// STATUS_INICIAL_MATRICULA no wizard.
const STATUS_LOTE_OPCOES = ["ativa", "inativa", "concluida", "cancelada"] as const;
const STATUS_LOTE_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_LOTE_OPCOES.map((status) => [status, MATRICULA_STATUS_LABELS[status]]),
);

function AcoesEmLoteBar({
  selecionados,
  onLimpar,
  onAplicado,
}: {
  selecionados: string[];
  onLimpar: () => void;
  onAplicado: () => void;
}) {
  const [novoStatus, setNovoStatus] = useState<string>(STATUS_LOTE_OPCOES[0]);
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleAplicar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await alterarStatusEmLote(selecionados, novoStatus);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setConfirmando(false);
      onAplicado();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {selecionados.length} matrícula{selecionados.length > 1 ? "s" : ""} selecionada
          {selecionados.length > 1 ? "s" : ""}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Alterar status para:</span>
          <Select
            items={STATUS_LOTE_ITEMS}
            value={novoStatus}
            onValueChange={(value) => setNovoStatus(value as string)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_LOTE_OPCOES.map((status) => (
                <SelectItem key={status} value={status}>
                  {MATRICULA_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AlertDialog
            open={confirmando}
            onOpenChange={(nextOpen) => {
              setConfirmando(nextOpen);
              if (nextOpen) setErro(null);
            }}
          >
            <AlertDialogTrigger render={<Button size="sm">Aplicar</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alterar status em lote</AlertDialogTitle>
                <AlertDialogDescription>
                  Alterar o status de {selecionados.length} matrícula{selecionados.length > 1 ? "s" : ""}{" "}
                  para &quot;{MATRICULA_STATUS_LABELS[novoStatus as (typeof STATUS_LOTE_OPCOES)[number]]}
                  &quot;?
                </AlertDialogDescription>
              </AlertDialogHeader>
              {erro && (
                <p role="alert" className="text-destructive text-sm">
                  {erro}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction disabled={isPending} onClick={handleAplicar}>
                  {isPending ? "Aplicando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button size="sm" variant="ghost" onClick={onLimpar}>
            Cancelar seleção
          </Button>
        </div>
      </div>
    </div>
  );
}

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

export function MatriculasTable({
  matriculas,
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
}: {
  matriculas: MatriculaListItem[];
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

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

  const idsVisiveis = useMemo(
    () => new Set(matriculasFiltradas.map((matricula) => matricula.id)),
    [matriculasFiltradas],
  );

  // Poda a seleção durante o render quando o filtro muda e algum item
  // selecionado sai da lista visível — mesmo padrão de
  // tabela-certificados-liberacao.tsx (ajuste de estado derivado durante o
  // render, não um useEffect, já que é só sincronização de estado a partir
  // de outro estado).
  const [idsVisiveisAnterior, setIdsVisiveisAnterior] = useState(idsVisiveis);
  if (idsVisiveis !== idsVisiveisAnterior) {
    setIdsVisiveisAnterior(idsVisiveis);
    setSelecionados((prev) => {
      const podados = Array.from(prev).filter((id) => idsVisiveis.has(id));
      return podados.length === prev.size ? prev : new Set(podados);
    });
  }

  function toggleMatricula(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodasVisiveis() {
    setSelecionados((prev) =>
      prev.size === matriculasFiltradas.length ? new Set() : new Set(matriculasFiltradas.map((m) => m.id)),
    );
  }

  const todasVisiveisSelecionadas =
    matriculasFiltradas.length > 0 && selecionados.size === matriculasFiltradas.length;

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
            {gerandoPdf ? "Gerando PDF..." : "Imprimir página atual"}
          </Button>
          <Button render={<Link href="/admin/matriculas/nova" />} nativeButton={false}>
            <Plus />
            Nova Matrícula
          </Button>
        </div>
      </div>

      {selecionados.size > 0 && (
        <AcoesEmLoteBar
          selecionados={Array.from(selecionados)}
          onLimpar={() => setSelecionados(new Set())}
          onAplicado={() => {
            setSelecionados(new Set());
            router.refresh();
          }}
        />
      )}

      {matriculasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma matrícula encontrada com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={todasVisiveisSelecionadas}
                  onCheckedChange={toggleTodasVisiveis}
                  aria-label="Selecionar todas as matrículas visíveis"
                />
              </TableHead>
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
                  <Checkbox
                    checked={selecionados.has(matricula.id)}
                    onCheckedChange={() => toggleMatricula(matricula.id)}
                    aria-label={`Selecionar matrícula de ${matricula.alunos?.full_name ?? "aluno"}`}
                  />
                </TableCell>
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
                  <Button
                    render={<Link href={`/admin/matriculas/${matricula.id}`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Ver
                  </Button>
                  <ContratoButton matricula={matricula} />
                  <WhatsappStubDropdown matriculaId={matricula.id} />
                  <CancelarMatriculaButton matricula={matricula} />
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
        baseUrl="/admin/matriculas"
      />
    </div>
  );
}
