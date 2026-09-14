"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRound, XCircle } from "lucide-react";
import { cancelarAssinaturaCandidato } from "@/app/admin/conecta/candidatos/actions";
import {
  DISPONIBILIDADE_LABELS,
  PLANO_CONECTA_INFO,
  type AlunosVisiveisResultado,
  type CandidatosExternosResultado,
  type PerfilConecta,
} from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function CancelarAssinaturaButton({ candidato, onCancelado }: { candidato: PerfilConecta; onCancelado: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await cancelarAssinaturaCandidato(candidato.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onCancelado();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive"
        disabled={isPending}
        onClick={handleClick}
      >
        <XCircle className="size-4" />
        {isPending ? "Cancelando..." : "Cancelar assinatura"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function AlunoCard({ nome, whatsapp, cidade, disponibilidade, visivel, cursosConcluidos }: {
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  disponibilidade: keyof typeof DISPONIBILIDADE_LABELS;
  visivel: boolean;
  cursosConcluidos: string[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-4" />
            <span className="font-medium">{nome}</span>
          </div>
          <Badge
            className={
              visivel
                ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }
          >
            {visivel ? "Visível" : "Oculto"}
          </Badge>
        </div>
        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <span>{whatsapp ?? "—"}</span>
          <span>{cidade ?? "—"}</span>
          <span>{DISPONIBILIDADE_LABELS[disponibilidade]}</span>
        </div>
        {cursosConcluidos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cursosConcluidos.map((curso) => (
              <Badge key={curso} variant="secondary" className="text-[11px]">
                {curso}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CandidatoExternoCard({ candidato, onAtualizado }: { candidato: PerfilConecta; onAtualizado: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-4" />
            <span className="font-medium">{candidato.nome ?? "—"}</span>
          </div>
          <Badge
            className={
              candidato.esta_ativo
                ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400"
            }
          >
            {candidato.esta_ativo ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <span>{candidato.email ?? "—"}</span>
          <span>{candidato.whatsapp ?? "—"}</span>
          <span>Plano: {candidato.plano ? PLANO_CONECTA_INFO[candidato.plano].label : "—"}</span>
          <span>Cadastrado em {formatDateBR(candidato.created_at)}</span>
        </div>
        {candidato.esta_ativo && (
          <div className="flex flex-wrap gap-2">
            <CancelarAssinaturaButton candidato={candidato} onCancelado={onAtualizado} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ConectaCandidatosView({
  aba,
  resultadoAlunos,
  resultadoExternos,
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
  query,
}: {
  aba: "alunos" | "externos";
  resultadoAlunos: AlunosVisiveisResultado;
  resultadoExternos: CandidatosExternosResultado;
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
  query: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ação "Cancelar assinatura" precisa recarregar a lista após o sucesso —
  // sem estado de servidor pra reconsultar aqui (a lista vem por prop, do
  // Server Component pai), router.refresh() é o jeito certo de re-executar
  // a página com os mesmos searchParams e pegar o dado já revalidado (a
  // action já chama revalidatePath).
  const [, startTransition] = useTransition();

  function navegar(overrides: Partial<{ tab: string; query: string; page: number }>) {
    const proximaAba = overrides.tab ?? aba;
    const proximaQuery = overrides.query ?? (overrides.tab ? "" : busca);
    const proximaPagina = overrides.page ?? 1;

    const params = new URLSearchParams();
    if (proximaAba !== "alunos") params.set("tab", proximaAba);
    if (proximaQuery.trim()) params.set("query", proximaQuery.trim());
    if (proximaPagina > 1) params.set("page", String(proximaPagina));
    const queryString = params.toString();
    router.push(queryString ? `/admin/conecta/candidatos?${queryString}` : "/admin/conecta/candidatos");
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navegar({ query: valor }), 500);
  }

  function handleTabChange(valor: string) {
    setBusca("");
    navegar({ tab: valor, query: "" });
  }

  const searchParamsAtuais: Record<string, string> = {};
  if (aba !== "alunos") searchParamsAtuais.tab = aba;
  if (query) searchParamsAtuais.query = query;

  return (
    <Tabs value={aba} onValueChange={handleTabChange} className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="alunos">Alunos visíveis</TabsTrigger>
        <TabsTrigger value="externos">Assinantes externos</TabsTrigger>
      </TabsList>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={busca}
          onChange={(e) => handleBuscaChange(e.target.value)}
          placeholder={aba === "alunos" ? "Buscar por nome..." : "Buscar por nome ou email..."}
          className="pl-9"
        />
      </div>

      <TabsContent value="alunos" className="flex flex-col gap-4">
        {resultadoAlunos.alunos.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Nenhum aluno com perfil visível encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resultadoAlunos.alunos.map((aluno) => (
              <AlunoCard key={aluno.id} {...aluno} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="externos" className="flex flex-col gap-4">
        {resultadoExternos.candidatos.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Nenhum candidato externo encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resultadoExternos.candidatos.map((candidato) => (
              <CandidatoExternoCard
                key={candidato.id}
                candidato={candidato}
                onAtualizado={() => startTransition(() => router.refresh())}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/conecta/candidatos"
        searchParams={searchParamsAtuais}
      />
    </Tabs>
  );
}
