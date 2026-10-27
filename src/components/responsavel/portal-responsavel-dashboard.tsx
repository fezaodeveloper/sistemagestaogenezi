"use client";

// "use client": busca os dados via Server Action no mount/troca de filho (useEffect), controla
// a seção ativa do menu e (quando há mais de uma matrícula) qual matrícula está em foco — tudo
// em useState local, sem sincronizar com a URL (pedido explícito da tarefa: "estado da seção
// ativa em useState no componente principal").

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  FileText,
  Home,
  LineChart,
  LogOut,
  Mail,
  Phone,
  Trophy,
  User,
  Wallet,
} from "lucide-react";
import {
  getDadosPortalResponsavelGlobal,
  type DadosPortal,
  type DadosPortalMatricula,
  type DadosResponsavelLogado,
} from "@/app/responsavel/actions";
import { PwaInstallButton } from "@/components/aluno/pwa-install-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_ALUNO_LABELS, STATUS_MATRICULA_LABELS } from "@/lib/responsavel/formatacao";
import { SecaoInicio } from "@/components/responsavel/secoes/secao-inicio";
import { SecaoFrequencia } from "@/components/responsavel/secoes/secao-frequencia";
import { SecaoCurso } from "@/components/responsavel/secoes/secao-curso";
import { SecaoAgenda } from "@/components/responsavel/secoes/secao-agenda";
import { SecaoFinanceiro } from "@/components/responsavel/secoes/secao-financeiro";
import { SecaoConquistas } from "@/components/responsavel/secoes/secao-conquistas";
import { SecaoDocumentos } from "@/components/responsavel/secoes/secao-documentos";
import { SecaoPerfil } from "@/components/responsavel/secoes/secao-perfil";

type SecaoId = "inicio" | "frequencia" | "curso" | "agenda" | "financeiro" | "conquistas" | "documentos" | "perfil";

const MENU_ITEMS: { id: SecaoId; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "frequencia", label: "Frequência", icon: LineChart },
  { id: "curso", label: "Curso", icon: BookOpen },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "conquistas", label: "Conquistas", icon: Trophy },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "perfil", label: "Perfil", icon: User },
];

function SecaoVaziaSemMatricula() {
  return (
    <p className="text-muted-foreground py-10 text-center text-sm">Nenhuma matrícula ativa encontrada.</p>
  );
}

export function PortalResponsavelDashboard({
  alunoId,
  responsavel,
  onTrocarFilho,
  onVoltarSeletor,
  onSair,
}: {
  alunoId: string;
  responsavel: DadosResponsavelLogado;
  onTrocarFilho: (alunoId: string) => void;
  onVoltarSeletor: (() => void) | null;
  onSair: () => void;
}) {
  const { filhos } = responsavel;
  const [dados, setDados] = useState<DadosPortal | null>(null);
  // Em vez de um booleano próprio resetado no corpo do effect (setState síncrono dentro de
  // effect, o que o linter recusa) — deriva "carregando" comparando o alunoId do último fetch
  // concluído com o atual: enquanto não bateram, a troca de filho ainda está em voo.
  const [alunoIdCarregado, setAlunoIdCarregado] = useState<string | null>(null);
  const carregando = alunoIdCarregado !== alunoId;

  const [secaoAtiva, setSecaoAtiva] = useState<SecaoId>("inicio");
  const [matriculaId, setMatriculaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getDadosPortalResponsavelGlobal(alunoId).then((resultado) => {
      if (cancelado) return;
      setDados(resultado);
      setAlunoIdCarregado(alunoId);
      setMatriculaId(resultado?.matriculas[0]?.id ?? null);
      setSecaoAtiva("inicio");
    });
    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  const matricula: DadosPortalMatricula | null =
    dados?.matriculas.find((m) => m.id === matriculaId) ?? dados?.matriculas[0] ?? null;

  function renderSecao() {
    if (!dados) return null;

    if (secaoAtiva === "conquistas") {
      return <SecaoConquistas badges={dados.badges} certificado={matricula?.certificado ?? null} />;
    }

    if (secaoAtiva === "perfil") {
      return <SecaoPerfil responsavel={responsavel} />;
    }

    if (!matricula) return <SecaoVaziaSemMatricula />;

    switch (secaoAtiva) {
      case "inicio":
        return <SecaoInicio aluno={dados.aluno} matricula={matricula} />;
      case "frequencia":
        return <SecaoFrequencia matricula={matricula} />;
      case "curso":
        return <SecaoCurso matricula={matricula} />;
      case "agenda":
        return <SecaoAgenda matricula={matricula} eventosCalendario={dados.eventosCalendario} />;
      case "financeiro":
        return <SecaoFinanceiro parcelas={matricula.parcelas} />;
      case "documentos":
        return <SecaoDocumentos matricula={matricula} />;
      default:
        return null;
    }
  }

  return (
    <div className="dark bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border/50 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {dados?.escola.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo em bucket público
            <img
              src={dados.escola.logoUrl}
              alt={dados.escola.nome ?? "Logo da escola"}
              className="size-9 rounded-md object-contain"
            />
          ) : (
            <div className="bg-muted flex size-9 items-center justify-center rounded-md text-lg">🎓</div>
          )}
          <div>
            <p className="text-sm font-semibold">Portal do Responsável</p>
            <p className="text-muted-foreground text-xs">Olá, {responsavel.nomeResponsavel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PwaInstallButton />
          {filhos.length > 1 && (
            <Select
              value={alunoId}
              items={Object.fromEntries(filhos.map((filho) => [filho.alunoId, filho.nomeAluno ?? "Aluno"]))}
              onValueChange={(value) => onTrocarFilho(String(value))}
            >
              <SelectTrigger className="w-40 sm:w-48">
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
              <span className="hidden sm:inline">Ver outros filhos</span>
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onSair}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {carregando ? (
        <p className="text-muted-foreground py-16 text-center text-sm">Carregando...</p>
      ) : !dados ? (
        <p className="text-muted-foreground py-16 text-center text-sm">Não foi possível carregar os dados deste aluno.</p>
      ) : (
        <div className="flex flex-1 flex-col md:flex-row">
          {/* Menu lateral — desktop. Em mobile vira bottom nav, ver abaixo. */}
          <nav className="border-border/50 hidden w-56 shrink-0 flex-col gap-1 border-r p-3 md:flex">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const ativo = secaoAtiva === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSecaoAtiva(item.id)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    ativo ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onSair}
              className="text-muted-foreground mt-2 flex items-center gap-2.5 rounded-md border-t px-3 pt-3 text-left text-sm transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </nav>

          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {/* Dados do aluno — sempre visíveis, independente da seção. */}
              <div className="flex items-center gap-4">
                {dados.aluno.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto do aluno em bucket público
                  <img
                    src={dados.aluno.fotoUrl}
                    alt={dados.aluno.full_name ?? "Aluno"}
                    className="size-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                    <User className="text-muted-foreground size-7" />
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
              </div>

              {/* Seletor de matrícula — só aparece com 2+ matrículas ativas simultâneas. */}
              {dados.matriculas.length > 1 && secaoAtiva !== "conquistas" && secaoAtiva !== "perfil" && (
                <Select
                  value={matriculaId ?? undefined}
                  items={Object.fromEntries(
                    dados.matriculas.map((m) => [
                      m.id,
                      `${m.nomeCurso} — ${m.nomeTurma} (${STATUS_MATRICULA_LABELS[m.status] ?? m.status})`,
                    ]),
                  )}
                  onValueChange={(value) => setMatriculaId(String(value))}
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dados.matriculas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nomeCurso} — {m.nomeTurma} ({STATUS_MATRICULA_LABELS[m.status] ?? m.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {renderSecao()}

              <p className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-4 text-center text-xs">
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
            </div>
          </main>
        </div>
      )}

      {/* Menu — mobile. Bottom nav com scroll horizontal (7 itens não cabem fixos numa tela pequena). */}
      {dados && (
        <nav className="bg-background border-border/50 fixed inset-x-0 bottom-0 z-50 flex items-center gap-1 overflow-x-auto border-t px-2 py-1.5 md:hidden">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const ativo = secaoAtiva === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSecaoAtiva(item.id)}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[11px] transition-colors ${
                  ativo ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`size-5 ${ativo ? "stroke-[2.5]" : ""}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
