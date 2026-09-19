"use client";

// "use client": formulário com estado, buscas sob demanda (aluno/curso),
// carregamento de turmas por curso e cálculo de valores.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  atualizarMatriculaCompleta,
  buscarAlunosParaWizard,
  buscarCursosParaWizard,
  buscarTurmasParaWizard,
  type AlunoParaMatricula,
  type CursoParaMatricula,
  type MatriculaDetalhada,
  type TurmaParaMatricula,
} from "@/app/admin/matriculas/actions";
import { CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import {
  DESCONTO_FORMATOS,
  DESCONTO_FORMATO_LABELS,
  DESCONTO_TIPOS,
  DESCONTO_TIPO_LABELS,
  FORMAS_PAGAMENTO,
  FORMA_PAGAMENTO_LABELS,
  MATRICULA_STATUSES,
  MATRICULA_STATUS_LABELS,
  NUM_PARCELAS_OPTIONS,
  type DescontoFormato,
  type DescontoTipo,
  type FormaPagamento,
  type MatriculaEdicaoInput,
  type MatriculaStatus,
} from "@/lib/matriculas/schema";
import { BuscaCombobox } from "@/components/admin/busca-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// "" = campo vazio (vira null); NaN = texto que não é número (o Zod recusa).
function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return null;
  return Number(limpo);
}

function calcularValorFinal(
  original: number | null,
  tipo: DescontoTipo,
  formato: DescontoFormato | null,
  desconto: number | null,
): number | null {
  if (original === null || Number.isNaN(original)) return null;
  if (tipo === "sem_bolsa" || !formato || !desconto || Number.isNaN(desconto)) return original;
  const final = formato === "porcentagem" ? original * (1 - desconto / 100) : original - desconto;
  return Math.max(0, Math.round(final * 100) / 100);
}

const DESCONTO_TIPO_ITEMS: Record<string, string> = DESCONTO_TIPO_LABELS;
const DESCONTO_FORMATO_ITEMS: Record<string, string> = DESCONTO_FORMATO_LABELS;
const FORMA_PAGAMENTO_ITEMS: Record<string, string> = FORMA_PAGAMENTO_LABELS;
const STATUS_ITEMS: Record<string, string> = MATRICULA_STATUS_LABELS;
const PARCELAS_ITEMS: Record<string, string> = Object.fromEntries(
  NUM_PARCELAS_OPTIONS.map((n) => [String(n), `${n}x`]),
);

type Valores = {
  valorOriginal: string;
  descontoTipo: DescontoTipo;
  descontoFormato: DescontoFormato | null;
  descontoValor: string;
  valorFinal: string;
  numParcelas: string;
  valorParcela: string;
};

export function MatriculaEditForm({
  matricula,
  turmasIniciais,
}: {
  matricula: MatriculaDetalhada;
  turmasIniciais: TurmaParaMatricula[];
}) {
  const router = useRouter();
  const cursoOriginal = matricula.turmas?.cursos ?? null;

  const [aluno, setAluno] = useState<AlunoParaMatricula | null>({
    id: matricula.aluno_id,
    full_name: matricula.alunos?.full_name ?? null,
    email: matricula.alunos?.email ?? "",
    cpf: matricula.alunos?.cpf ?? "",
    telefone: matricula.alunos?.telefone ?? "",
  });
  const [curso, setCurso] = useState<CursoParaMatricula | null>(
    cursoOriginal
      ? {
          id: cursoOriginal.id,
          nome: cursoOriginal.nome,
          tipo: cursoOriginal.tipo,
          carga_horaria_horas: cursoOriginal.carga_horaria_horas,
          valor: null,
          descricao: cursoOriginal.descricao,
        }
      : null,
  );

  // A turma atual pode não estar na lista de turmas "ativas" do curso (ex.:
  // planejada) — entra na lista mesmo assim, senão o Select ficaria vazio.
  const turmaAtualFallback: TurmaParaMatricula = {
    id: matricula.turma_id,
    nome: matricula.turmas?.nome ?? "Turma atual",
    vagas_total: 0,
    vagas_ocupadas: 0,
    cadencia_dias_semana: matricula.turmas?.cadencia_dias_semana ?? null,
    horario_aula: matricula.turmas?.horario_aula ?? null,
    data_inicio: matricula.turmas?.data_inicio ?? "",
    data_fim: matricula.turmas?.data_fim ?? "",
  };
  const [turmas, setTurmas] = useState<TurmaParaMatricula[]>(
    turmasIniciais.some((t) => t.id === matricula.turma_id) ? turmasIniciais : [turmaAtualFallback, ...turmasIniciais],
  );
  const [turmaId, setTurmaId] = useState(matricula.turma_id);
  const [carregandoTurmas, startTurmas] = useTransition();

  const [status, setStatus] = useState<MatriculaStatus>(matricula.status);
  const [dataInicio, setDataInicio] = useState(matricula.data_inicio ?? "");
  const [previsaoConclusao, setPrevisaoConclusao] = useState(matricula.previsao_conclusao ?? "");
  const [dataPrimeiraMensalidade, setDataPrimeiraMensalidade] = useState(matricula.data_primeira_mensalidade ?? "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(matricula.forma_pagamento ?? "boleto");
  const [valores, setValores] = useState<Valores>({
    valorOriginal: matricula.valor_original?.toString() ?? "",
    descontoTipo: matricula.desconto_tipo ?? "sem_bolsa",
    descontoFormato: matricula.desconto_formato,
    descontoValor: matricula.desconto_valor?.toString() ?? "",
    valorFinal: matricula.valor_final?.toString() ?? "",
    numParcelas: String(matricula.num_parcelas ?? 1),
    valorParcela: matricula.valor_parcela?.toString() ?? "",
  });
  const [apostila, setApostila] = useState(matricula.apostila_entregue);
  const [farda, setFarda] = useState(matricula.farda_entregue);
  const [kit, setKit] = useState(matricula.kit_entregue);
  const [observacoes, setObservacoes] = useState(matricula.observacoes ?? "");

  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const turmaItems: Record<string, string> = Object.fromEntries(
    turmas.map((t) => [
      t.id,
      t.vagas_total > 0 ? `${t.nome} — ${Math.max(0, t.vagas_total - t.vagas_ocupadas)} vaga(s)` : t.nome,
    ]),
  );
  const vinculoAlterado = aluno?.id !== matricula.aluno_id || turmaId !== matricula.turma_id;

  function selecionarCurso(novo: CursoParaMatricula) {
    setCurso(novo);
    setTurmaId("");
    startTurmas(async () => {
      const lista = await buscarTurmasParaWizard(novo.id);
      // Se voltou pro curso original, mantém a turma atual disponível.
      const inclui = novo.id === cursoOriginal?.id && !lista.some((t) => t.id === matricula.turma_id);
      setTurmas(inclui ? [turmaAtualFallback, ...lista] : lista);
    });
  }

  // Recalcula valor final (e parcela) quando mudam os campos de origem;
  // editar o valor final ou o nº de parcelas só recalcula a parcela.
  function atualizarValores(patch: Partial<Valores>, recalcularFinal: boolean) {
    setValores((prev) => {
      const prox = { ...prev, ...patch };
      if (recalcularFinal) {
        const final = calcularValorFinal(
          paraNumero(prox.valorOriginal),
          prox.descontoTipo,
          prox.descontoFormato,
          paraNumero(prox.descontoValor),
        );
        prox.valorFinal = final === null ? "" : final.toFixed(2);
      }
      const final = paraNumero(prox.valorFinal);
      const parcelas = Number(prox.numParcelas);
      if (final !== null && !Number.isNaN(final) && parcelas > 0) {
        prox.valorParcela = (final / parcelas).toFixed(2);
      }
      return prox;
    });
  }

  function handleSalvar() {
    setErro(null);
    if (!aluno) {
      setErro("Selecione o aluno.");
      return;
    }
    if (!turmaId) {
      setErro("Selecione a turma.");
      return;
    }

    const semDesconto = valores.descontoTipo === "sem_bolsa";
    const payload: MatriculaEdicaoInput = {
      aluno_id: aluno.id,
      turma_id: turmaId,
      status,
      data_inicio: dataInicio,
      previsao_conclusao: previsaoConclusao || null,
      valor_original: paraNumero(valores.valorOriginal),
      desconto_tipo: valores.descontoTipo,
      desconto_formato: semDesconto ? null : valores.descontoFormato,
      desconto_valor: semDesconto ? 0 : paraNumero(valores.descontoValor),
      valor_final: paraNumero(valores.valorFinal),
      num_parcelas: Number(valores.numParcelas),
      valor_parcela: paraNumero(valores.valorParcela),
      forma_pagamento: formaPagamento,
      data_primeira_mensalidade: dataPrimeiraMensalidade || null,
      farda_entregue: farda,
      apostila_entregue: apostila,
      kit_entregue: kit,
      observacoes,
    };

    startTransition(async () => {
      const resultado = await atualizarMatriculaCompleta(matricula.id, payload);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      router.push(`/admin/matriculas/${matricula.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/admin/matriculas/${matricula.id}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
        >
          <ArrowLeft />
          Voltar para a matrícula
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Editar matrícula</h1>
        <p className="text-muted-foreground text-sm">
          {matricula.alunos?.full_name ?? "Aluno"} — {matricula.turmas?.cursos?.nome ?? "Curso"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Aluno, curso e turma</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="aluno">Aluno vinculado</Label>
                <BuscaCombobox<AlunoParaMatricula>
                  id="aluno"
                  selecionado={aluno}
                  buscar={buscarAlunosParaWizard}
                  rotulo={(a) => a.full_name ?? a.email}
                  detalhe={(a) => a.email}
                  placeholder="Nome, CPF ou e-mail..."
                  onSelecionar={setAluno}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="curso">Curso</Label>
                <BuscaCombobox<CursoParaMatricula>
                  id="curso"
                  selecionado={curso}
                  buscar={buscarCursosParaWizard}
                  rotulo={(c) => c.nome}
                  detalhe={(c) => CURSO_TIPO_LABELS[c.tipo]}
                  placeholder="Digite o nome do curso..."
                  onSelecionar={selecionarCurso}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Modalidade</Label>
                <Input readOnly value={curso ? CURSO_TIPO_LABELS[curso.tipo] : "—"} />
                <p className="text-muted-foreground text-xs">
                  A modalidade (presencial, híbrido ou EAD) é do curso — para mudá-la, escolha outro curso.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="turma">Turma</Label>
                <Select
                  items={turmaItems}
                  value={turmaId}
                  onValueChange={(valor) => valor && setTurmaId(valor)}
                  disabled={carregandoTurmas}
                >
                  <SelectTrigger id="turma" className="w-full">
                    <SelectValue placeholder={carregandoTurmas ? "Carregando turmas..." : "Selecione a turma"} />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {turmaItems[t.id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!carregandoTurmas && turmas.length === 0 && (
                  <p className="text-muted-foreground text-xs">Nenhuma turma ativa para este curso.</p>
                )}
              </div>

              {vinculoAlterado && (
                <p className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  Você está trocando o aluno e/ou a turma. Se a matrícula já tiver presenças, aulas concluídas, provas
                  ou certificado, trocar o aluno ou mudar para outro curso será recusado (misturaria o histórico) —
                  nesse caso, cancele esta matrícula e crie uma nova. Ao trocar o aluno, as parcelas e o contrato vão
                  junto.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datas e status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="data_inicio">Data de início</Label>
                  <Input id="data_inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="previsao">Previsão de conclusão</Label>
                  <Input
                    id="previsao"
                    type="date"
                    value={previsaoConclusao}
                    onChange={(e) => setPrevisaoConclusao(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">Status da matrícula</Label>
                <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => v && setStatus(v as MatriculaStatus)}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATRICULA_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MATRICULA_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Valores e pagamento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="valor_original">Valor total (original)</Label>
                <Input
                  id="valor_original"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valores.valorOriginal}
                  onChange={(e) => atualizarValores({ valorOriginal: e.target.value }, true)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="desconto_tipo">Tipo de desconto</Label>
                <Select
                  items={DESCONTO_TIPO_ITEMS}
                  value={valores.descontoTipo}
                  onValueChange={(v) =>
                    v &&
                    atualizarValores(
                      {
                        descontoTipo: v as DescontoTipo,
                        descontoFormato: v === "sem_bolsa" ? null : (valores.descontoFormato ?? "porcentagem"),
                      },
                      true,
                    )
                  }
                >
                  <SelectTrigger id="desconto_tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESCONTO_TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {DESCONTO_TIPO_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {valores.descontoTipo !== "sem_bolsa" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="desconto_formato">Formato</Label>
                    <Select
                      items={DESCONTO_FORMATO_ITEMS}
                      value={valores.descontoFormato ?? "porcentagem"}
                      onValueChange={(v) => v && atualizarValores({ descontoFormato: v as DescontoFormato }, true)}
                    >
                      <SelectTrigger id="desconto_formato" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DESCONTO_FORMATOS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {DESCONTO_FORMATO_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="desconto_valor">Desconto</Label>
                    <Input
                      id="desconto_valor"
                      inputMode="decimal"
                      value={valores.descontoValor}
                      onChange={(e) => atualizarValores({ descontoValor: e.target.value }, true)}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="valor_final">Valor final</Label>
                <Input
                  id="valor_final"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valores.valorFinal}
                  onChange={(e) => atualizarValores({ valorFinal: e.target.value }, false)}
                />
                <p className="text-muted-foreground text-xs">
                  Calculado a partir do valor total e do desconto; pode ser ajustado manualmente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="num_parcelas">Parcelas</Label>
                  <Select
                    items={PARCELAS_ITEMS}
                    value={valores.numParcelas}
                    onValueChange={(v) => v && atualizarValores({ numParcelas: v }, false)}
                  >
                    <SelectTrigger id="num_parcelas" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUM_PARCELAS_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="valor_parcela">Valor da parcela</Label>
                  <Input
                    id="valor_parcela"
                    inputMode="decimal"
                    value={valores.valorParcela}
                    onChange={(e) => setValores((prev) => ({ ...prev, valorParcela: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
                  <Select
                    items={FORMA_PAGAMENTO_ITEMS}
                    value={formaPagamento}
                    onValueChange={(v) => v && setFormaPagamento(v as FormaPagamento)}
                  >
                    <SelectTrigger id="forma_pagamento" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FORMA_PAGAMENTO_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="primeira_mensalidade">1ª mensalidade</Label>
                  <Input
                    id="primeira_mensalidade"
                    type="date"
                    value={dataPrimeiraMensalidade}
                    onChange={(e) => setDataPrimeiraMensalidade(e.target.value)}
                  />
                </div>
              </div>

              <p className="bg-muted/50 text-muted-foreground rounded-md p-2.5 text-xs">
                Alterar valores, parcelamento ou forma de pagamento aqui atualiza a matrícula, mas{" "}
                <strong>não recalcula as parcelas já geradas</strong> — ajuste-as na tela Financeiro, se necessário.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Materiais e observações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={apostila} onCheckedChange={(v) => setApostila(v === true)} />
                  Apostila entregue
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={farda} onCheckedChange={(v) => setFarda(v === true)} />
                  Farda entregue
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={kit} onCheckedChange={(v) => setKit(v === true)} />
                  Kit entregue
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" rows={4} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSalvar} disabled={isPending || carregandoTurmas}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={`/admin/matriculas/${matricula.id}`} />}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
