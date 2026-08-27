"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Plus } from "lucide-react";
import {
  cancelarParcela,
  criarParcelaManual,
  gerarCobranca,
  getFinanceiroDados,
  registrarPagamentoManual,
  type FinanceiroDados,
  type MatriculaParaParcela,
  type ParcelaComRelacoes,
} from "@/app/admin/financeiro/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
} from "@/lib/financeiro/schema";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABELS } from "@/lib/matriculas/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...PARCELA_STATUS_LABELS,
};

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function KpiCard({
  label,
  valor,
  cor,
  sublabel,
}: {
  label: string;
  valor: string;
  cor: "amber" | "green" | "red" | "blue";
  sublabel?: string;
}) {
  const corTexto: Record<string, string> = {
    amber: "#FFB020",
    green: "#2DD4A0",
    red: "#FF5A5F",
    blue: "#2196F3",
  };
  return (
    <Card className={`gz-kpi gz-kpi-${cor}`}>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
          {label}
        </span>
        <span className="gz-num text-[22px]" style={{ color: corTexto[cor] }}>
          {valor}
        </span>
        {sublabel && <span className="text-muted-foreground text-xs">{sublabel}</span>}
      </CardContent>
    </Card>
  );
}

function NovaParcelaDialog({
  matriculas,
  onCriada,
}: {
  matriculas: MatriculaParaParcela[];
  onCriada: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [matriculaId, setMatriculaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matriculaItems = Object.fromEntries(
    matriculas.map((matricula) => [
      matricula.id,
      `${matricula.alunos?.full_name ?? "—"} — ${matricula.turmas?.nome ?? "—"}`,
    ]),
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarParcelaManual(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      setMatriculaId("");
      onCriada();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Nova parcela manual
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova parcela manual</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="matricula_id">Matrícula</Label>
            <Select
              name="matricula_id"
              items={matriculaItems}
              value={matriculaId}
              onValueChange={(value) => setMatriculaId(value as string)}
            >
              <SelectTrigger id="matricula_id" className="w-full">
                <SelectValue placeholder="Selecione a matrícula" />
              </SelectTrigger>
              <SelectContent>
                {matriculas.map((matricula) => (
                  <SelectItem key={matricula.id} value={matricula.id}>
                    {matricula.alunos?.full_name ?? "—"} — {matricula.turmas?.nome ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="numero_parcela">Nº da parcela</Label>
              <Input id="numero_parcela" name="numero_parcela" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor</Label>
              <Input id="valor" name="valor" type="number" step="0.01" min={0.01} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_vencimento">Vencimento</Label>
            <Input id="data_vencimento" name="data_vencimento" type="date" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Select name="forma_pagamento" items={FORMA_PAGAMENTO_LABELS}>
              <SelectTrigger id="forma_pagamento" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((formaPagamento) => (
                  <SelectItem key={formaPagamento} value={formaPagamento}>
                    {FORMA_PAGAMENTO_LABELS[formaPagamento]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" name="observacoes" placeholder="Opcional" />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !matriculaId}>
              {isPending ? "Salvando..." : "Criar parcela"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AcoesParcela({
  parcela,
  onAtualizada,
}: {
  parcela: ParcelaComRelacoes;
  onAtualizada: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);

  function handleGerarCobranca() {
    setError(null);
    startTransition(async () => {
      const resultado = await gerarCobranca(parcela.id);
      if ("error" in resultado) setError(resultado.error);
      else onAtualizada();
    });
  }

  function handleCancelar() {
    setError(null);
    startTransition(async () => {
      const resultado = await cancelarParcela(parcela.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setConfirmandoCancelamento(false);
      onAtualizada();
    });
  }

  function handleRegistrarPagamento(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await registrarPagamentoManual(parcela.id, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setPagamentoDialogOpen(false);
      onAtualizada();
    });
  }

  const emAberto = parcela.status === "pendente" || parcela.status === "atrasado";
  const podeGerarCobranca = emAberto && !parcela.asaas_payment_id;
  const podeRegistrarManual = emAberto && !parcela.asaas_payment_id;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {podeGerarCobranca && (
          <Button variant="ghost" size="sm" onClick={handleGerarCobranca} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar cobrança"}
          </Button>
        )}
        {parcela.asaas_invoice_url && (
          <Button
            render={<a href={parcela.asaas_invoice_url} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            <ExternalLink />
            Ver fatura
          </Button>
        )}
        {podeRegistrarManual && (
          <Dialog
            open={pagamentoDialogOpen}
            onOpenChange={(nextOpen) => {
              setPagamentoDialogOpen(nextOpen);
              if (nextOpen) setError(null);
            }}
          >
            <DialogTrigger render={<Button variant="ghost" size="sm">Registrar pagamento</Button>} />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Registrar pagamento manual</DialogTitle>
              </DialogHeader>
              <form action={handleRegistrarPagamento} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`data_pagamento_${parcela.id}`}>Data do pagamento</Label>
                  <Input
                    id={`data_pagamento_${parcela.id}`}
                    name="data_pagamento"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`forma_pagamento_${parcela.id}`}>Forma de pagamento</Label>
                  <Select
                    name="forma_pagamento"
                    items={FORMA_PAGAMENTO_LABELS}
                    defaultValue={parcela.forma_pagamento ?? undefined}
                  >
                    <SelectTrigger id={`forma_pagamento_${parcela.id}`} className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((formaPagamento) => (
                        <SelectItem key={formaPagamento} value={formaPagamento}>
                          {FORMA_PAGAMENTO_LABELS[formaPagamento]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {error && (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Salvando..." : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
        {emAberto && (
          <AlertDialog open={confirmandoCancelamento} onOpenChange={setConfirmandoCancelamento}>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm">Cancelar</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar parcela</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar a parcela {parcela.numero_parcela} de &quot;
                  {parcela.alunos?.full_name ?? "—"}&quot;?
                  {parcela.asaas_payment_id &&
                    " A cobrança correspondente também será cancelada no Asaas."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleCancelar}>
                  {isPending ? "Cancelando..." : "Cancelar parcela"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {error && !pagamentoDialogOpen && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

export function FinanceiroView({
  dadosIniciais,
  anoInicial,
  mesInicial,
  matriculas,
}: {
  dadosIniciais: FinanceiroDados;
  anoInicial: number;
  mesInicial: number;
  matriculas: MatriculaParaParcela[];
}) {
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [dados, setDados] = useState(dadosIniciais);
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);

  function irParaMes(novoAno: number, novoMes: number) {
    startTransition(async () => {
      const novosDados = await getFinanceiroDados(novoAno, novoMes);
      setAno(novoAno);
      setMes(novoMes);
      setDados(novosDados);
    });
  }

  function recarregar() {
    startTransition(async () => {
      const novosDados = await getFinanceiroDados(ano, mes);
      setDados(novosDados);
    });
  }

  function handleMesAnterior() {
    irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
  }

  function handleProximoMes() {
    irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
  }

  const parcelasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dados.parcelas.filter((parcela) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && parcela.status !== statusFiltro) return false;
      if (!termo) return true;
      const nomeAluno = (parcela.alunos?.full_name ?? "").toLowerCase();
      return nomeAluno.includes(termo);
    });
  }, [dados.parcelas, busca, statusFiltro]);

  const adimplencia = useMemo(() => {
    const denominador = dados.kpis.totalRecebido + dados.kpis.totalAtrasado;
    if (denominador === 0) return null;
    return (dados.kpis.totalRecebido / denominador) * 100;
  }, [dados.kpis]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleMesAnterior}
            disabled={isPending}
            aria-label="Mês anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="w-40 text-center text-lg font-semibold">
            {NOMES_MES[mes - 1]} {ano}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleProximoMes}
            disabled={isPending}
            aria-label="Próximo mês"
          >
            <ChevronRight />
          </Button>
        </div>

        <NovaParcelaDialog matriculas={matriculas} onCriada={recarregar} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard label="A receber" valor={formatValor(dados.kpis.totalReceber)} cor="amber" />
        <KpiCard label="Recebido no mês" valor={formatValor(dados.kpis.totalRecebido)} cor="green" />
        <KpiCard
          label="Em atraso"
          valor={formatValor(dados.kpis.totalAtrasado)}
          cor="red"
          sublabel={`${dados.kpis.countAtrasado} parcela(s)`}
        />
        <KpiCard
          label="Adimplência"
          valor={adimplencia === null ? "—" : `${adimplencia.toFixed(0)}%`}
          cor="blue"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por aluno..."
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

      {parcelasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma parcela encontrada para {NOMES_MES[mes - 1]} de {ano}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Curso/Turma</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Forma de pagamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelasFiltradas.map((parcela) => (
              <TableRow key={parcela.id}>
                <TableCell>{parcela.alunos?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{parcela.matriculas?.turmas?.cursos?.nome ?? "—"}</span>
                    <span className="text-muted-foreground text-xs">
                      {parcela.matriculas?.turmas?.nome ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {parcela.numero_parcela}/{parcela.matriculas?.num_parcelas ?? "?"}
                </TableCell>
                <TableCell>{formatDataBR(parcela.data_vencimento)}</TableCell>
                <TableCell>{formatValor(Number(parcela.valor))}</TableCell>
                <TableCell>
                  <Badge className={PARCELA_STATUS_BADGE_CLASS[parcela.status]}>
                    {PARCELA_STATUS_LABELS[parcela.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {parcela.forma_pagamento ? FORMA_PAGAMENTO_LABELS[parcela.forma_pagamento] : "—"}
                </TableCell>
                <TableCell>
                  <AcoesParcela parcela={parcela} onAtualizada={recarregar} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
