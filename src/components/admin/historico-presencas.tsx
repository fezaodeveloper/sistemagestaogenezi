"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import {
  adicionarPresencaAvulsa,
  editarPresenca,
} from "@/app/admin/turmas/[id]/alunos/[matriculaId]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  FREQUENCIA_MINIMA_PERCENTUAL,
  FREQUENCIA_STATUS_BADGE_CLASS,
  PRESENCA_STATUSES,
  PRESENCA_STATUS_BADGE_CLASS,
  PRESENCA_STATUS_LABELS,
} from "@/lib/presencas/schema";

type PresencaStatus = (typeof PRESENCA_STATUSES)[number];

export type MatriculaHistoricoAluno = {
  full_name: string | null;
  email: string;
  cpf: string;
  telefone: string;
};

export type PresencaHistoricoRow = {
  id: string;
  data: string;
  status: PresencaStatus;
  data_reposicao: string | null;
  justificativa: string | null;
  aula_id: string;
  aulas: { titulo: string; modulos: { titulo: string } | null } | null;
};

export type AulaOpcao = { id: string; titulo: string };

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC),
// mesmo padrão usado em turma-detalhes.tsx.
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function calcularResumo(presencas: PresencaHistoricoRow[]) {
  const totalAulas = presencas.length;
  const presentes = presencas.filter(
    (presenca) => presenca.status === "presente" || presenca.status === "reposicao",
  ).length;
  const faltas = presencas.filter(
    (presenca) => presenca.status === "falta" || presenca.status === "justificada",
  ).length;
  const percentual = totalAulas > 0 ? Math.round((presentes / totalAulas) * 100) : 0;

  return {
    totalAulas,
    presentes,
    faltas,
    percentual,
    apto: percentual >= FREQUENCIA_MINIMA_PERCENTUAL,
  };
}

function FormPresencaAvulsa({
  matriculaId,
  turmaId,
  aulasDisponiveis,
  onAdicionado,
  onFechar,
}: {
  matriculaId: string;
  turmaId: string;
  aulasDisponiveis: AulaOpcao[];
  onAdicionado: () => void;
  onFechar: () => void;
}) {
  const [aulaId, setAulaId] = useState("");
  const [data, setData] = useState("");
  const [status, setStatus] = useState<PresencaStatus>("presente");
  const [justificativa, setJustificativa] = useState("");
  const [dataReposicao, setDataReposicao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const aulaItems = Object.fromEntries(aulasDisponiveis.map((aula) => [aula.id, aula.titulo]));

  function handleSalvar() {
    if (!aulaId) {
      setErro("Selecione a aula.");
      return;
    }
    if (!data) {
      setErro("Informe a data.");
      return;
    }
    setErro(null);

    const formData = new FormData();
    formData.set("aula_id", aulaId);
    formData.set("data", data);
    formData.set("status", status);
    formData.set("justificativa", justificativa);
    formData.set("data_reposicao", dataReposicao);

    startTransition(async () => {
      const resultado = await adicionarPresencaAvulsa(matriculaId, turmaId, formData);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      onAdicionado();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar presença avulsa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="avulsa_aula_id">Aula</Label>
            <Select items={aulaItems} value={aulaId} onValueChange={(value) => setAulaId(String(value))}>
              <SelectTrigger id="avulsa_aula_id" className="w-full">
                <SelectValue placeholder="Selecione a aula" />
              </SelectTrigger>
              <SelectContent>
                {aulasDisponiveis.map((aula) => (
                  <SelectItem key={aula.id} value={aula.id}>
                    {aula.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="avulsa_data">Data</Label>
            <Input
              id="avulsa_data"
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="avulsa_status">Status</Label>
          <Select
            items={PRESENCA_STATUS_LABELS}
            value={status}
            onValueChange={(value) => setStatus(value as PresencaStatus)}
          >
            <SelectTrigger id="avulsa_status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESENCA_STATUSES.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {PRESENCA_STATUS_LABELS[opcao]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {status === "reposicao" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="avulsa_data_reposicao">Data da reposição</Label>
            <Input
              id="avulsa_data_reposicao"
              type="date"
              className="max-w-48"
              value={dataReposicao}
              onChange={(event) => setDataReposicao(event.target.value)}
            />
          </div>
        )}

        {status === "justificada" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="avulsa_justificativa">Justificativa</Label>
            <Textarea
              id="avulsa_justificativa"
              rows={2}
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
            />
          </div>
        )}

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoricoRow({
  presenca,
  matriculaId,
  turmaId,
  onAtualizado,
}: {
  presenca: PresencaHistoricoRow;
  matriculaId: string;
  turmaId: string;
  onAtualizado: (atualizado: PresencaHistoricoRow) => void;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState<PresencaStatus>(presenca.status);
  const [justificativa, setJustificativa] = useState(presenca.justificativa ?? "");
  const [dataReposicao, setDataReposicao] = useState(presenca.data_reposicao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function iniciarEdicao() {
    setStatus(presenca.status);
    setJustificativa(presenca.justificativa ?? "");
    setDataReposicao(presenca.data_reposicao ?? "");
    setErro(null);
    setEditando(true);
  }

  function cancelar() {
    setErro(null);
    setEditando(false);
  }

  function salvar() {
    setErro(null);

    const formData = new FormData();
    formData.set("status", status);
    formData.set("justificativa", justificativa);
    formData.set("data_reposicao", dataReposicao);

    startTransition(async () => {
      const resultado = await editarPresenca(presenca.id, matriculaId, turmaId, formData);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      onAtualizado({
        ...presenca,
        status,
        justificativa: status === "justificada" ? justificativa : null,
        data_reposicao: status === "reposicao" ? dataReposicao : null,
      });
      setEditando(false);
      router.refresh();
    });
  }

  if (editando) {
    return (
      <TableRow>
        <TableCell colSpan={7}>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <Select
                  items={PRESENCA_STATUS_LABELS}
                  value={status}
                  onValueChange={(value) => setStatus(value as PresencaStatus)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESENCA_STATUSES.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {PRESENCA_STATUS_LABELS[opcao]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {status === "reposicao" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Data da reposição</Label>
                  <Input
                    type="date"
                    value={dataReposicao}
                    onChange={(event) => setDataReposicao(event.target.value)}
                  />
                </div>
              )}
            </div>

            {status === "justificada" && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Justificativa</Label>
                <Textarea
                  rows={2}
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                />
              </div>
            )}

            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={salvar} disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelar} disabled={isPending}>
                Cancelar
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{formatDataBR(presenca.data)}</TableCell>
      <TableCell>{presenca.aulas?.titulo ?? "—"}</TableCell>
      <TableCell>{presenca.aulas?.modulos?.titulo ?? "—"}</TableCell>
      <TableCell>
        <Badge className={PRESENCA_STATUS_BADGE_CLASS[presenca.status]}>
          {PRESENCA_STATUS_LABELS[presenca.status]}
        </Badge>
      </TableCell>
      <TableCell>{presenca.justificativa ?? "—"}</TableCell>
      <TableCell>{presenca.data_reposicao ? formatDataBR(presenca.data_reposicao) : "—"}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={iniciarEdicao}>
          Editar
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function HistoricoPresencas({
  matriculaId,
  turmaId,
  aluno,
  turmaNome,
  cursoNome,
  presencas: presencasIniciais,
  aulasDisponiveis,
}: {
  matriculaId: string;
  turmaId: string;
  aluno: MatriculaHistoricoAluno | null;
  turmaNome: string;
  cursoNome: string;
  presencas: PresencaHistoricoRow[];
  aulasDisponiveis: AulaOpcao[];
}) {
  const router = useRouter();
  const [presencas, setPresencas] = useState(presencasIniciais);
  const [mostrarForm, setMostrarForm] = useState(false);

  // adicionarPresencaAvulsa não devolve a linha criada (só {success}) — depois
  // de adicionar, um router.refresh() busca a lista atualizada no servidor
  // (com o título da aula/módulo já resolvido) e a prop presencasIniciais
  // muda. Ajustar o estado durante a própria renderização (padrão oficial do
  // React pra "resetar estado quando uma prop muda") evita o cascading render
  // de fazer isso num useEffect.
  const [presencasSincronizadas, setPresencasSincronizadas] = useState(presencasIniciais);
  if (presencasIniciais !== presencasSincronizadas) {
    setPresencasSincronizadas(presencasIniciais);
    setPresencas(presencasIniciais);
  }

  const resumo = useMemo(() => calcularResumo(presencas), [presencas]);

  function handleAtualizarLinha(atualizado: PresencaHistoricoRow) {
    setPresencas((atual) => atual.map((presenca) => (presenca.id === atualizado.id ? atualizado : presenca)));
  }

  function handleAdicionado() {
    setMostrarForm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/admin/turmas/${turmaId}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
        >
          <ArrowLeft />
          Voltar
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{aluno?.full_name || aluno?.email || "—"}</h1>
          <p className="text-muted-foreground text-sm">
            {turmaNome} · {cursoNome}
          </p>
        </div>
        <Button onClick={() => setMostrarForm((atual) => !atual)}>
          <Plus />
          Adicionar presença avulsa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 text-sm">
          <p className="text-muted-foreground">
            Total de aulas: <span className="text-foreground font-medium">{resumo.totalAulas}</span>
          </p>
          <p className="text-muted-foreground">
            Presenças: <span className="text-foreground font-medium">{resumo.presentes}</span>
          </p>
          <p className="text-muted-foreground">
            Faltas: <span className="text-foreground font-medium">{resumo.faltas}</span>
          </p>
          <p className="text-muted-foreground">
            Frequência: <span className="text-foreground font-medium">{resumo.percentual}%</span>
          </p>
          <Badge
            className={
              resumo.apto ? FREQUENCIA_STATUS_BADGE_CLASS.apto : FREQUENCIA_STATUS_BADGE_CLASS.inapto
            }
          >
            {resumo.apto ? "Apto" : "Inapto"}
          </Badge>
        </CardContent>
      </Card>

      {mostrarForm && (
        <FormPresencaAvulsa
          matriculaId={matriculaId}
          turmaId={turmaId}
          aulasDisponiveis={aulasDisponiveis}
          onAdicionado={handleAdicionado}
          onFechar={() => setMostrarForm(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de presenças</CardTitle>
        </CardHeader>
        <CardContent>
          {presencas.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhuma presença registrada ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Aula</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Reposição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {presencas.map((presenca) => (
                  <HistoricoRow
                    key={presenca.id}
                    presenca={presenca}
                    matriculaId={matriculaId}
                    turmaId={turmaId}
                    onAtualizado={handleAtualizarLinha}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
