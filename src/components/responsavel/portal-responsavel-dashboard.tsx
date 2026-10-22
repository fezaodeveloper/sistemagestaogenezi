"use client";

// "use client": busca os dados via Server Action no mount/troca de filho (useEffect) — props
// mínimas (alunoId + a lista de filhos pra montar o seletor do header), sem repassar dados já
// buscados no Server Component pai, pra manter PortalResponsavelAuth simples e o dashboard
// autocontido.

import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Phone, User } from "lucide-react";
import { getDadosPortalResponsavelGlobal, type DadosPortal, type FilhoResponsavel } from "@/app/responsavel/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_ALUNO_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  trancado: "Trancado",
  formado: "Formado",
};

const STATUS_MATRICULA_LABELS: Record<string, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
  transferida: "Transferida",
};

const STATUS_PARCELA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

const STATUS_PARCELA_BADGE: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
  pago: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  atrasado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  cancelado: "bg-muted text-muted-foreground",
  estornado: "bg-muted text-muted-foreground",
};

function formatValor(valor: number): string {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// dd/mm/aaaa a partir de "yyyy-mm-dd"/timestamptz — evita o desvio de fuso de usar `new
// Date(...)` direto numa string de data pura (interpretada como UTC), mesmo critério já usado em
// todo o projeto.
function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function corFrequencia(percentual: number): string {
  if (percentual >= 75) return "text-green-500";
  if (percentual >= 60) return "text-amber-500";
  return "text-red-500";
}

function corBarraFrequencia(percentual: number): string {
  if (percentual >= 75) return "bg-green-500";
  if (percentual >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function SecaoVazia({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground py-6 text-center text-sm">{mensagem}</CardContent>
    </Card>
  );
}

function SecaoProgresso({ progresso }: { progresso: DadosPortal["matriculas"][number]["progresso"] }) {
  if (progresso.total === 0) {
    return <SecaoVazia titulo="Progresso no curso" mensagem="Progresso não disponível." />;
  }
  const percentual = Math.round((progresso.concluidas / progresso.total) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progresso no curso</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
          <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${percentual}%` }} />
        </div>
        <span className="text-muted-foreground text-sm">
          {progresso.concluidas} de {progresso.total} aulas concluídas · {percentual}%
        </span>
      </CardContent>
    </Card>
  );
}

function SecaoFrequencia({ frequencia }: { frequencia: DadosPortal["matriculas"][number]["frequencia"] }) {
  if (frequencia.totalAulas === 0) {
    return <SecaoVazia titulo="Frequência" mensagem="Dados não disponíveis." />;
  }
  const percentual = Math.round((frequencia.presentes / frequencia.totalAulas) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Frequência</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-semibold ${corFrequencia(percentual)}`}>{percentual}%</span>
          <span className="text-muted-foreground text-sm">
            {frequencia.presentes} presenças em {frequencia.totalAulas} aulas
          </span>
        </div>
        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
          <div className={`h-full rounded-full transition-all ${corBarraFrequencia(percentual)}`} style={{ width: `${percentual}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function SecaoFinanceiro({ parcelas }: { parcelas: DadosPortal["matriculas"][number]["parcelas"] }) {
  if (parcelas.length === 0) {
    return <SecaoVazia titulo="Financeiro" mensagem="Sem parcelas em aberto." />;
  }
  const emAberto = parcelas.filter((p) => p.status === "pendente" || p.status === "atrasado");
  const totalEmAberto = emAberto.reduce((soma, p) => soma + Number(p.valor), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Financeiro</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelas.map((parcela) => {
              const linkPagamento = parcela.asaas_invoice_url ?? parcela.asaas_bank_slip_url;
              const emAbertoParcela = parcela.status === "pendente" || parcela.status === "atrasado";
              return (
                <TableRow key={parcela.id}>
                  <TableCell>{parcela.numero_parcela}</TableCell>
                  <TableCell>{formatDataBR(parcela.data_vencimento)}</TableCell>
                  <TableCell>{formatValor(parcela.valor)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_PARCELA_BADGE[parcela.status] ?? ""}>
                      {STATUS_PARCELA_LABELS[parcela.status] ?? parcela.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {emAbertoParcela && linkPagamento && (
                      <Button
                        render={<a href={linkPagamento} target="_blank" rel="noopener noreferrer" />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        Pagar
                      </Button>
                    )}
                    {parcela.status === "pago" && (
                      <Button
                        render={
                          <a href={`/api/comprovantes/parcela/${parcela.id}/pdf`} target="_blank" rel="noopener noreferrer" />
                        }
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                      >
                        Recibo
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {emAberto.length > 0 && (
          <p className="text-sm font-medium">
            Total em aberto: <span className="text-amber-500">{formatValor(totalEmAberto)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SecaoDocumentos({ matricula }: { matricula: DadosPortal["matriculas"][number] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Contrato de matrícula</span>
          {matricula.statusContrato === "aceito" ? (
            <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
              Assinado em {formatDataBR(matricula.contratoAssinadoEm)}
            </Badge>
          ) : (
            <Button render={<a href={`/contrato/${matricula.id}/assinar`} />} nativeButton={false} variant="outline" size="sm">
              Assinar Contrato →
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Termo de uso de imagem</span>
          {matricula.termoImagemAssinado ? (
            <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
              Assinado em {formatDataBR(matricula.termoImagemAssinadoEm)}
            </Badge>
          ) : (
            <Button
              render={<a href={`/termo-imagem/${matricula.id}/assinar`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Assinar Termo →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalResponsavelDashboard({
  alunoId,
  nomeResponsavel,
  filhos,
  onTrocarFilho,
  onVoltarSeletor,
}: {
  alunoId: string;
  nomeResponsavel: string;
  filhos: FilhoResponsavel[];
  onTrocarFilho: (alunoId: string) => void;
  onVoltarSeletor: (() => void) | null;
}) {
  const [dados, setDados] = useState<DadosPortal | null>(null);
  // Em vez de um booleano próprio resetado no corpo do effect (setState síncrono dentro de
  // effect, o que o linter recusa) — deriva "carregando" comparando o alunoId do último fetch
  // concluído com o atual: enquanto não bateram, a troca de filho ainda está em voo.
  const [alunoIdCarregado, setAlunoIdCarregado] = useState<string | null>(null);
  const carregando = alunoIdCarregado !== alunoId;

  useEffect(() => {
    let cancelado = false;
    getDadosPortalResponsavelGlobal(alunoId).then((resultado) => {
      if (cancelado) return;
      setDados(resultado);
      setAlunoIdCarregado(alunoId);
    });
    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  return (
    <div className="dark bg-background text-foreground min-h-screen">
      <header className="border-border/50 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          {dados?.escola.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo em bucket público
            <img src={dados.escola.logoUrl} alt={dados.escola.nome ?? "Logo da escola"} className="size-10 rounded-md object-contain" />
          ) : (
            <div className="bg-muted flex size-10 items-center justify-center rounded-md text-lg">🎓</div>
          )}
          <div>
            <p className="font-semibold">Portal do Responsável</p>
            <p className="text-muted-foreground text-xs">Olá, {nomeResponsavel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filhos.length > 1 && (
            <Select
              value={alunoId}
              items={Object.fromEntries(filhos.map((filho) => [filho.alunoId, filho.nomeAluno ?? "Aluno"]))}
              onValueChange={(value) => onTrocarFilho(String(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filhos.map((filho) => (
                  <SelectItem key={filho.alunoId} value={filho.alunoId}>
                    {filho.nomeAluno ?? "Aluno"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onVoltarSeletor && (
            <Button type="button" variant="ghost" size="sm" onClick={onVoltarSeletor}>
              <ArrowLeft className="size-4" />
              Ver outros filhos
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-8">
        {carregando ? (
          <p className="text-muted-foreground text-center text-sm">Carregando...</p>
        ) : !dados ? (
          <p className="text-muted-foreground text-center text-sm">Não foi possível carregar os dados deste aluno.</p>
        ) : (
          <>
            {/* Seção 1 — Dados do aluno */}
            <Card>
              <CardContent className="flex items-center gap-4 py-5">
                {dados.aluno.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto do aluno em bucket público
                  <img src={dados.aluno.fotoUrl} alt={dados.aluno.full_name ?? "Aluno"} className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="bg-muted flex size-16 items-center justify-center rounded-full">
                    <User className="text-muted-foreground size-8" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold">{dados.aluno.full_name ?? "Aluno"}</span>
                  {dados.aluno.status_aluno && (
                    <Badge variant="outline" className="w-fit">
                      {STATUS_ALUNO_LABELS[dados.aluno.status_aluno] ?? dados.aluno.status_aluno}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {dados.matriculas.length === 0 ? (
              <>
                <SecaoVazia titulo="Progresso no curso" mensagem="Nenhuma matrícula ativa encontrada." />
                <SecaoVazia titulo="Frequência" mensagem="Nenhuma matrícula ativa encontrada." />
                <SecaoVazia titulo="Financeiro" mensagem="Nenhuma matrícula ativa encontrada." />
                <SecaoVazia titulo="Documentos" mensagem="Nenhuma matrícula ativa encontrada." />
              </>
            ) : (
              dados.matriculas.map((matricula) => (
                <div key={matricula.id} className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <h2 className="text-lg font-semibold">
                      {matricula.nomeCurso} — {matricula.nomeTurma}
                    </h2>
                    <Badge variant="outline">{STATUS_MATRICULA_LABELS[matricula.status] ?? matricula.status}</Badge>
                  </div>

                  {/* Seção 2 — Progresso */}
                  <SecaoProgresso progresso={matricula.progresso} />
                  {/* Seção 3 — Frequência */}
                  <SecaoFrequencia frequencia={matricula.frequencia} />
                  {/* Seção 4 — Financeiro */}
                  <SecaoFinanceiro parcelas={matricula.parcelas} />
                  {/* Seção 5 — Documentos */}
                  <SecaoDocumentos matricula={matricula} />
                </div>
              ))
            )}

            {/* Seção 6 — Contato da escola */}
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-4 text-center text-sm">
              <span>Dúvidas? Entre em contato com a escola:</span>
              {dados.escola.telefone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5" />
                  {dados.escola.telefone}
                </span>
              )}
              {dados.escola.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5" />
                  {dados.escola.email}
                </span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
