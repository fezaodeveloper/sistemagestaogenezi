"use client";

import { useRef, useState, useTransition } from "react";
import { Search, UserRound, XCircle } from "lucide-react";
import { cancelarAssinaturaCandidato, listarCandidatosExternos } from "@/app/admin/conecta/candidatos/actions";
import { PLANO_CONECTA_INFO, type CandidatosExternosResultado, type PerfilConecta } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";

const LIMITE_PADRAO = 12;

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

function CandidatoCard({ candidato, onAtualizado }: { candidato: PerfilConecta; onAtualizado: () => void }) {
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
  resultadoInicial,
}: {
  resultadoInicial: CandidatosExternosResultado;
}) {
  const [resultado, setResultado] = useState(resultadoInicial);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function carregar(overrides: { query?: string; page?: number }) {
    const novaQuery = overrides.query ?? busca;
    const novaPagina = overrides.page ?? pagina;

    startTransition(async () => {
      const atualizado = await listarCandidatosExternos({
        query: novaQuery.trim() || undefined,
        page: novaPagina,
        limit: LIMITE_PADRAO,
      });
      setResultado(atualizado);
      setPagina(novaPagina);
    });
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      carregar({ query: valor, page: 1 });
    }, 500);
  }

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / LIMITE_PADRAO));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={busca}
          onChange={(e) => handleBuscaChange(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="pl-9"
        />
      </div>

      {resultado.candidatos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhum candidato externo encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resultado.candidatos.map((candidato) => (
            <CandidatoCard key={candidato.id} candidato={candidato} onAtualizado={() => carregar({})} />
          ))}
        </div>
      )}

      <Paginacao
        paginaAtual={pagina}
        totalPaginas={totalPaginas}
        totalRegistros={resultado.total}
        limite={LIMITE_PADRAO}
        onNavigate={(novaPagina) => carregar({ page: novaPagina })}
      />
    </div>
  );
}
