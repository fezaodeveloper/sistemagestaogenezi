"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Loader2, Pencil, Printer } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import {
  updateMatriculaDetalhes,
  type MatriculaDetalhada,
} from "@/app/admin/matriculas/actions";
import { MatriculaComprovantePdf } from "@/components/admin/matricula-comprovante-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCpf, formatTelefone } from "@/lib/alunos/schema";
import { CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { DIA_SEMANA_LABELS, type DIAS_SEMANA } from "@/lib/turmas/schema";
import {
  DESCONTO_TIPO_LABELS,
  FORMA_PAGAMENTO_LABELS,
  MATRICULA_STATUS_BADGE_CLASS,
  MATRICULA_STATUS_LABELS,
  type MatriculaStatus,
} from "@/lib/matriculas/schema";

function formatValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatParcelas(numParcelas: number | null, valorParcela: number | null): string {
  if (!numParcelas || valorParcela === null) return "—";
  return `${numParcelas}x de ${formatValor(valorParcela)}`;
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC),
// mesmo padrão usado em matriculas-table.tsx e matricula-wizard.tsx.
function formatDataBR(isoDate: string | null): string {
  if (!isoDate) return "—";
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

function formatDiasSemana(dias: (typeof DIAS_SEMANA)[number][] | null | undefined): string {
  if (!dias || dias.length === 0) return "—";
  return dias.map((dia) => DIA_SEMANA_LABELS[dia]).join(", ");
}

function formatDesconto(matricula: MatriculaDetalhada): string {
  if (
    matricula.desconto_tipo === null ||
    matricula.desconto_tipo === "sem_bolsa" ||
    matricula.desconto_formato === null ||
    matricula.desconto_valor === null
  ) {
    return "Sem desconto";
  }
  const valor =
    matricula.desconto_formato === "porcentagem"
      ? `${matricula.desconto_valor}%`
      : formatValor(matricula.desconto_valor);
  return `${DESCONTO_TIPO_LABELS[matricula.desconto_tipo]} (${valor})`;
}

// "transferida" é alias visual legado de "inativa" (ver MATRICULA_STATUSES em
// lib/matriculas/schema.ts) — só existe por causa de dados históricos, não
// deve ser oferecida como opção nova na edição manual do status.
const STATUS_EDITAVEIS: MatriculaStatus[] = ["ativa", "inativa", "concluida", "cancelada"];

const STATUS_SELECT_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_EDITAVEIS.map((valor) => [valor, MATRICULA_STATUS_LABELS[valor]]),
);

export function MatriculaDetalhes({ matricula }: { matricula: MatriculaDetalhada }) {
  const router = useRouter();

  const [matriculaAtual, setMatriculaAtual] = useState(matricula);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [status, setStatus] = useState<MatriculaStatus>(matricula.status);
  const [dataInicio, setDataInicio] = useState(matricula.data_inicio ?? "");
  const [previsaoConclusao, setPrevisaoConclusao] = useState(matricula.previsao_conclusao ?? "");
  const [apostilaEntregue, setApostilaEntregue] = useState(matricula.apostila_entregue);
  const [fardaEntregue, setFardaEntregue] = useState(matricula.farda_entregue);
  const [kitEntregue, setKitEntregue] = useState(matricula.kit_entregue);
  const [observacoes, setObservacoes] = useState(matricula.observacoes ?? "");

  function entrarEdicao() {
    setStatus(matriculaAtual.status);
    setDataInicio(matriculaAtual.data_inicio ?? "");
    setPrevisaoConclusao(matriculaAtual.previsao_conclusao ?? "");
    setApostilaEntregue(matriculaAtual.apostila_entregue);
    setFardaEntregue(matriculaAtual.farda_entregue);
    setKitEntregue(matriculaAtual.kit_entregue);
    setObservacoes(matriculaAtual.observacoes ?? "");
    setErro(null);
    setSucesso(false);
    setModoEdicao(true);
  }

  function cancelarEdicao() {
    setStatus(matriculaAtual.status);
    setModoEdicao(false);
    setErro(null);
  }

  function handleSalvar() {
    setErro(null);

    const formData = new FormData();
    formData.set("status", status);
    formData.set("data_inicio", dataInicio);
    formData.set("previsao_conclusao", previsaoConclusao);
    formData.set("farda_entregue", String(fardaEntregue));
    formData.set("apostila_entregue", String(apostilaEntregue));
    formData.set("kit_entregue", String(kitEntregue));
    formData.set("observacoes", observacoes);

    startTransition(async () => {
      const result = await updateMatriculaDetalhes(matriculaAtual.id, formData);
      if ("error" in result) {
        setErro(result.error);
        return;
      }

      setMatriculaAtual((atual) => ({
        ...atual,
        status,
        data_inicio: dataInicio,
        previsao_conclusao: previsaoConclusao || null,
        farda_entregue: fardaEntregue,
        apostila_entregue: apostilaEntregue,
        kit_entregue: kitEntregue,
        observacoes: observacoes.trim() || null,
      }));
      setModoEdicao(false);
      setSucesso(true);
      router.refresh();
    });
  }

  async function handleImprimirComprovante() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — mesmo padrão de matricula-wizard.tsx/matriculas-table.tsx.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <MatriculaComprovantePdf
          resumo={{
            aluno: {
              full_name: matriculaAtual.alunos?.full_name ?? null,
              email: matriculaAtual.alunos?.email ?? "—",
              cpf: matriculaAtual.alunos?.cpf ?? "",
              telefone: matriculaAtual.alunos?.telefone ?? "",
            },
            curso: {
              nome: matriculaAtual.turmas?.cursos?.nome ?? "—",
              tipo: matriculaAtual.turmas?.cursos?.tipo ?? "presencial",
              carga_horaria_horas: matriculaAtual.turmas?.cursos?.carga_horaria_horas ?? null,
            },
            turma: {
              nome: matriculaAtual.turmas?.nome ?? "—",
              cadencia_dias_semana: matriculaAtual.turmas?.cadencia_dias_semana ?? null,
              horario_aula: matriculaAtual.turmas?.horario_aula ?? null,
            },
            valorOriginal: matriculaAtual.valor_original,
            descontoTipo: matriculaAtual.desconto_tipo ?? "sem_bolsa",
            descontoFormato: matriculaAtual.desconto_formato,
            descontoValor: matriculaAtual.desconto_valor ?? 0,
            valorFinal: matriculaAtual.valor_final,
            numParcelas: matriculaAtual.num_parcelas ?? 1,
            valorParcela: matriculaAtual.valor_parcela,
            formaPagamento: matriculaAtual.forma_pagamento ?? "outro",
            dataPrimeiraMensalidade: matriculaAtual.data_primeira_mensalidade ?? "",
            dataInicio: matriculaAtual.data_inicio ?? "",
            previsaoConclusao: matriculaAtual.previsao_conclusao,
            apostilaEntregue: matriculaAtual.apostila_entregue,
            fardaEntregue: matriculaAtual.farda_entregue,
            kitEntregue: matriculaAtual.kit_entregue,
            observacoes: matriculaAtual.observacoes ?? "",
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

  function renderSecaoAluno() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aluno</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{matriculaAtual.alunos?.full_name ?? "—"}</p>
          <p className="text-muted-foreground">{matriculaAtual.alunos?.email ?? "—"}</p>
          <p className="text-muted-foreground">
            CPF: {matriculaAtual.alunos ? formatCpf(matriculaAtual.alunos.cpf) : "—"} · Tel:{" "}
            {matriculaAtual.alunos ? formatTelefone(matriculaAtual.alunos.telefone) : "—"}
          </p>
        </CardContent>
      </Card>
    );
  }

  function renderSecaoCursoTurma() {
    const curso = matriculaAtual.turmas?.cursos ?? null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curso e Turma</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{curso?.nome ?? "—"}</p>
          <p className="text-muted-foreground">
            {curso ? CURSO_TIPO_LABELS[curso.tipo] : "—"}
            {curso?.carga_horaria_horas ? ` · ${curso.carga_horaria_horas}h` : ""}
          </p>
          <p className="text-muted-foreground">Turma: {matriculaAtual.turmas?.nome ?? "—"}</p>
          <p className="text-muted-foreground">
            {formatDiasSemana(matriculaAtual.turmas?.cadencia_dias_semana)}
            {matriculaAtual.turmas?.horario_aula ? ` · ${matriculaAtual.turmas.horario_aula}` : ""}
          </p>
        </CardContent>
      </Card>
    );
  }

  function renderSecaoFinanceiro() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p className="text-muted-foreground">
            Valor original: <span className="text-foreground">{formatValor(matriculaAtual.valor_original)}</span>
          </p>
          <p className="text-muted-foreground">
            Desconto: <span className="text-foreground">{formatDesconto(matriculaAtual)}</span>
          </p>
          <p className="text-muted-foreground">
            Valor final: <span className="text-foreground">{formatValor(matriculaAtual.valor_final)}</span>
          </p>
          <p className="text-muted-foreground">
            Parcelamento:{" "}
            <span className="text-foreground">
              {formatParcelas(matriculaAtual.num_parcelas, matriculaAtual.valor_parcela)}
            </span>
          </p>
          <p className="text-muted-foreground">
            Forma de pagamento:{" "}
            <span className="text-foreground">
              {matriculaAtual.forma_pagamento ? FORMA_PAGAMENTO_LABELS[matriculaAtual.forma_pagamento] : "—"}
            </span>
          </p>
          <p className="text-muted-foreground">
            1ª mensalidade:{" "}
            <span className="text-foreground">
              {formatDataBR(matriculaAtual.data_primeira_mensalidade)}
            </span>
          </p>
          {matriculaAtual.taxa_cartao !== null && (
            <p className="text-muted-foreground">
              Taxa de cartão: <span className="text-foreground">{matriculaAtual.taxa_cartao}%</span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderSecaoDatas() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {modoEdicao ? (
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
                  type="date"
                  value={previsaoConclusao}
                  onChange={(event) => setPrevisaoConclusao(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-muted-foreground">
                Início: <span className="text-foreground">{formatDataBR(matriculaAtual.data_inicio)}</span>
              </p>
              <p className="text-muted-foreground">
                Previsão de conclusão:{" "}
                <span className="text-foreground">{formatDataBR(matriculaAtual.previsao_conclusao)}</span>
              </p>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            Data da matrícula:{" "}
            <span className="text-foreground">{formatDataBR(matriculaAtual.data_matricula)}</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  function renderSecaoMateriais() {
    if (!modoEdicao) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Materiais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className={matriculaAtual.apostila_entregue ? "text-foreground" : "text-muted-foreground"}>
              {matriculaAtual.apostila_entregue ? "✓ Apostila entregue" : "✗ Apostila não entregue"}
            </p>
            <p className={matriculaAtual.farda_entregue ? "text-foreground" : "text-muted-foreground"}>
              {matriculaAtual.farda_entregue ? "✓ Farda entregue" : "✗ Farda não entregue"}
            </p>
            <p className={matriculaAtual.kit_entregue ? "text-foreground" : "text-muted-foreground"}>
              {matriculaAtual.kit_entregue ? "✓ Kit entregue" : "✗ Kit não entregue"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Materiais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
        </CardContent>
      </Card>
    );
  }

  function renderSecaoObservacoes() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          {modoEdicao ? (
            <Textarea
              id="observacoes"
              rows={4}
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Opcional"
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {matriculaAtual.observacoes || "Nenhuma observação registrada"}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderSecaoStatus() {
    if (!modoEdicao) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="max-w-64">
          <Select
            items={STATUS_SELECT_ITEMS}
            value={status}
            onValueChange={(value) => setStatus(value as MatriculaStatus)}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_EDITAVEIS.map((valor) => (
                <SelectItem key={valor} value={valor}>
                  {MATRICULA_STATUS_LABELS[valor]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href="/admin/matriculas" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
        >
          <ArrowLeft />
          Voltar para matrículas
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Detalhes da Matrícula</h1>
          <Badge className={MATRICULA_STATUS_BADGE_CLASS[status]}>{MATRICULA_STATUS_LABELS[status]}</Badge>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImprimirComprovante} disabled={gerandoPdf}>
            <Printer />
            {gerandoPdf ? "Gerando PDF..." : "Imprimir Comprovante"}
          </Button>
          {!modoEdicao && (
            <Button onClick={entrarEdicao}>
              <Pencil />
              Editar
            </Button>
          )}
        </div>
      </div>

      {sucesso && !modoEdicao && (
        <p className="text-sm text-green-600 dark:text-green-400">Alterações salvas com sucesso.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {renderSecaoAluno()}
        {renderSecaoCursoTurma()}
      </div>

      {renderSecaoFinanceiro()}
      {renderSecaoStatus()}
      {renderSecaoDatas()}
      {renderSecaoMateriais()}
      {renderSecaoObservacoes()}

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {modoEdicao && (
        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button variant="outline" onClick={cancelarEdicao} disabled={isPending}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
