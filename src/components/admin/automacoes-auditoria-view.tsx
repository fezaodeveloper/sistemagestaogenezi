"use client";

// "use client": toda a aba carrega dados sob demanda via Server Actions (useEffect no mount +
// filtros interativos), não vem pronta do Server Component — ver comentário em page.tsx.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Send, Users } from "lucide-react";
import { enviarLembreteAulaWhatsappAction } from "@/app/admin/matriculas/actions";
import {
  enviarLembreteAulaEmLoteAction,
  getAlunosSemLembreteAulaAction,
  getDiagnosticoTurmaAction,
  getHistoricoNotificacoesAction,
  getTurmasAtivasParaSelectAction,
  getVisaoGeralAuditoriaAction,
} from "@/app/admin/automacoes/actions";
import {
  TIPO_LABELS_AUDITORIA,
  type AlunoDiagnosticoTurma,
  type AlunoSemLembrete,
  type HistoricoNotificacao,
  type TurmaOpcao,
  type VisaoGeralAuditoria,
} from "@/lib/relatorios/auditoria-notificacoes-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatarDataHora(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

// ===== Visão geral =====

function VisaoGeralSection({ dados }: { dados: VisaoGeralAuditoria | null }) {
  if (!dados) return <div className="bg-muted h-24 w-full animate-pulse rounded-md" />;

  const cartoes = [
    { label: "Total enviados (30d)", valor: dados.totalEnviados30d, icone: Send, cor: "" },
    { label: "Erros (30d)", valor: dados.totalErros30d, icone: AlertTriangle, cor: dados.totalErros30d > 0 ? "text-red-600 dark:text-red-400" : "" },
    { label: "% sucesso", valor: `${dados.percentualSucesso}%`, icone: CheckCircle2, cor: "text-green-600 dark:text-green-400" },
    { label: "Alunos sem notificação", valor: dados.alunosSemNotificacao, icone: Users, cor: dados.alunosSemNotificacao > 0 ? "text-amber-600 dark:text-amber-400" : "" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cartoes.map((cartao) => (
        <Card key={cartao.label}>
          <CardContent className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">{cartao.label}</span>
              <cartao.icone className="text-muted-foreground size-4" />
            </div>
            <span className={`text-2xl font-semibold tabular-nums ${cartao.cor}`}>{cartao.valor}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== Alunos sem lembrete =====

function AlunosSemLembreteSection({
  alunos,
  carregando,
  onRecarregar,
}: {
  alunos: AlunoSemLembrete[] | null;
  carregando: boolean;
  onRecarregar: () => void;
}) {
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function enviarUm(matriculaId: string) {
    setEnviandoId(matriculaId);
    setMensagem(null);
    try {
      const resultado = await enviarLembreteAulaWhatsappAction(matriculaId);
      setMensagem("error" in resultado ? resultado.error : "Lembrete enviado!");
      onRecarregar();
    } finally {
      setEnviandoId(null);
    }
  }

  async function enviarTodos() {
    if (!alunos || alunos.length === 0) return;
    setEnviandoLote(true);
    setMensagem(null);
    try {
      const resultado = await enviarLembreteAulaEmLoteAction(alunos.map((a) => a.matriculaId));
      setMensagem(`✅ ${resultado.enviados} enviado(s), ❌ ${resultado.erros} erro(s).`);
      onRecarregar();
    } finally {
      setEnviandoLote(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">⚠️ Alunos que deveriam receber mas não receberam (lembrete de aula, 7 dias)</CardTitle>
        {alunos && alunos.length > 0 && (
          <Button size="sm" variant="outline" disabled={enviandoLote} onClick={enviarTodos}>
            <Send className="size-3.5" />
            {enviandoLote ? "Enviando..." : "Enviar para todos sem lembrete"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mensagem && <p className="text-muted-foreground text-sm">{mensagem}</p>}
        {carregando || !alunos ? (
          <div className="bg-muted h-32 w-full animate-pulse rounded-md" />
        ) : alunos.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Todos os alunos com matrícula ativa receberam o lembrete nos últimos 7 dias. 🎉</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Último envio</TableHead>
                <TableHead />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunos.map((aluno) => (
                <TableRow key={aluno.matriculaId}>
                  <TableCell className="font-medium">{aluno.alunoNome}</TableCell>
                  <TableCell>{aluno.turmaNome}</TableCell>
                  <TableCell>{aluno.whatsapp ?? "—"}</TableCell>
                  <TableCell>{formatarDataHora(aluno.ultimoEnvio)}</TableCell>
                  <TableCell>
                    {aluno.numeroSuspeito ? (
                      <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Número suspeito</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">Sem lembrete</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={enviandoId === aluno.matriculaId} onClick={() => enviarUm(aluno.matriculaId)}>
                      {enviandoId === aluno.matriculaId ? "Enviando..." : "Enviar agora"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Diagnóstico por turma =====

function TurmaDiagnosticoSection({ turmas }: { turmas: TurmaOpcao[] }) {
  const [turmaId, setTurmaId] = useState("");
  const [alunos, setAlunos] = useState<AlunoDiagnosticoTurma[] | null>(null);
  const [carregando, startCarregar] = useTransition();

  function handleTurmaChange(valor: string) {
    setTurmaId(valor);
    setAlunos(null);
    if (!valor) return;
    startCarregar(async () => {
      setAlunos(await getDiagnosticoTurmaAction(valor));
    });
  }

  const falharam = alunos?.filter((a) => a.ultimoStatus === "falha").length ?? 0;
  const semEnvio = alunos?.filter((a) => a.ultimoStatus === null).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">🔍 Diagnóstico por turma</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Select items={{ "": "Escolha uma turma...", ...Object.fromEntries(turmas.map((t) => [t.id, t.nome])) }} value={turmaId} onValueChange={(v) => handleTurmaChange(v ?? "")}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Escolha uma turma..." />
          </SelectTrigger>
          <SelectContent>
            {turmas.map((turma) => (
              <SelectItem key={turma.id} value={turma.id}>
                {turma.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {carregando && <div className="bg-muted h-32 w-full animate-pulse rounded-md" />}

        {!carregando && alunos && (
          <>
            {alunos.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {falharam > 0 && `${falharam} com falha de envio. `}
                {semEnvio > 0 && `${semEnvio} nunca receberam nenhum lembrete. `}
                {falharam === 0 && semEnvio === 0 && "Todos os alunos desta turma já receberam lembrete com sucesso."}
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Recebeu?</TableHead>
                  <TableHead>Último envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alunos.map((aluno) => (
                  <TableRow key={aluno.matriculaId}>
                    <TableCell className="font-medium">{aluno.alunoNome}</TableCell>
                    <TableCell>{aluno.whatsapp ?? "—"}</TableCell>
                    <TableCell>
                      {aluno.recebeu ? (
                        <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">Sim</Badge>
                      ) : aluno.ultimoStatus === "falha" ? (
                        <Badge className="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">Falhou</Badge>
                      ) : (
                        <Badge variant="outline">Nunca</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatarDataHora(aluno.ultimoEnvio)}</TableCell>
                  </TableRow>
                ))}
                {alunos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-6 text-center text-sm">
                      Nenhuma matrícula ativa nesta turma.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Histórico completo =====

const STATUS_HISTORICO_ITEMS: Record<string, string> = { "": "Todos os status", enviado: "Enviado", falha: "Falha", pendente: "Pendente" };
const STATUS_BADGE_CLASS: Record<string, string> = {
  enviado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falha: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  pendente: "bg-muted text-muted-foreground",
};
const LIMITE_HISTORICO = 25;

function HistoricoSection({ turmas }: { turmas: TurmaOpcao[] }) {
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ itens: HistoricoNotificacao[]; total: number } | null>(null);
  const [carregando, startCarregar] = useTransition();

  useEffect(() => {
    startCarregar(async () => {
      setResultado(await getHistoricoNotificacoesAction({ tipo: tipo || undefined, status: status || undefined, turmaId: turmaId || undefined, page: pagina, limite: LIMITE_HISTORICO }));
    });
  }, [tipo, status, turmaId, pagina]);

  const tiposItems: Record<string, string> = { "": "Todos os tipos", ...TIPO_LABELS_AUDITORIA };
  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / LIMITE_HISTORICO)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">📜 Histórico completo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Select items={tiposItems} value={tipo} onValueChange={(v) => { setTipo(v ?? ""); setPagina(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(tiposItems).map((chave) => (
                <SelectItem key={chave || "todos"} value={chave}>
                  {tiposItems[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={STATUS_HISTORICO_ITEMS} value={status} onValueChange={(v) => { setStatus(v ?? ""); setPagina(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STATUS_HISTORICO_ITEMS).map((chave) => (
                <SelectItem key={chave || "todos"} value={chave}>
                  {STATUS_HISTORICO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={{ "": "Todas as turmas", ...Object.fromEntries(turmas.map((t) => [t.id, t.nome])) }} value={turmaId} onValueChange={(v) => { setTurmaId(v ?? ""); setPagina(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as turmas</SelectItem>
              {turmas.map((turma) => (
                <SelectItem key={turma.id} value={turma.id}>
                  {turma.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {carregando || !resultado ? (
          <div className="bg-muted h-64 w-full animate-pulse rounded-md" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Aluno/Lead</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.itens.map((item) => (
                  <TableRow key={item.id} className={item.status === "falha" ? "bg-red-500/5" : item.status === "enviado" ? "bg-green-500/5" : ""}>
                    <TableCell>{formatarDataHora(item.createdAt)}</TableCell>
                    <TableCell>{item.alunoOuLeadNome}</TableCell>
                    <TableCell>{TIPO_LABELS_AUDITORIA[item.tipo] ?? item.tipo}</TableCell>
                    <TableCell className="uppercase">{item.canal}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE_CLASS[item.status] ?? ""} title={item.erro ?? undefined}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{item.enviadoPor}</TableCell>
                  </TableRow>
                ))}
                {resultado.itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-6 text-center text-sm">
                      Nenhuma notificação encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {resultado.total} registro(s) · página {pagina} de {totalPaginas}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AutomacoesAuditoriaView() {
  const [visaoGeral, setVisaoGeral] = useState<VisaoGeralAuditoria | null>(null);
  const [alunosSemLembrete, setAlunosSemLembrete] = useState<AlunoSemLembrete[] | null>(null);
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(true);

  async function recarregarAlunosSemLembrete() {
    setCarregandoAlunos(true);
    try {
      const [novosAlunos, novaVisaoGeral] = await Promise.all([getAlunosSemLembreteAulaAction(), getVisaoGeralAuditoriaAction()]);
      setAlunosSemLembrete(novosAlunos);
      setVisaoGeral(novaVisaoGeral);
    } finally {
      setCarregandoAlunos(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void recarregarAlunosSemLembrete();
      getTurmasAtivasParaSelectAction().then(setTurmas);
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <VisaoGeralSection dados={visaoGeral} />
      <AlunosSemLembreteSection alunos={alunosSemLembrete} carregando={carregandoAlunos} onRecarregar={recarregarAlunosSemLembrete} />
      <TurmaDiagnosticoSection turmas={turmas} />
      <HistoricoSection turmas={turmas} />
      <p className="text-muted-foreground text-xs">
        Precisa ver o dado bruto? A tabela de log fica em <code className="bg-muted rounded px-1">mensagens_enviadas</code>. Para editar os
        textos das mensagens, veja{" "}
        <Link href="/admin/configuracoes" className="underline">
          Configurações
        </Link>
        .
      </p>
    </div>
  );
}
