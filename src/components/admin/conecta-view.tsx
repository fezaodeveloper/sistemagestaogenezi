"use client";

import { useRef, useState, useTransition } from "react";
import { Bell, Building2, Check, MessageCircle, Pause, Search } from "lucide-react";
import {
  ativarEmpresa,
  enviarNotificacaoEmpresa,
  excluirEmpresa,
  getEmpresasConecta,
  suspenderEmpresa,
} from "@/app/admin/conecta/actions";
import {
  EMPRESA_STATUS_BADGE_CLASS,
  EMPRESA_STATUS_LABELS,
  EMPRESA_STATUSES,
  type EmpresaConectaComExtras,
  type EmpresasConectaResultado,
} from "@/lib/conecta/schema";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
import { Textarea } from "@/components/ui/textarea";

const LIMITE_PADRAO = 12;

const FILTROS = ["todas", ...EMPRESA_STATUSES] as const;
type Filtro = (typeof FILTROS)[number];

const FILTRO_LABELS: Record<Filtro, string> = {
  todas: "Todas",
  ...EMPRESA_STATUS_LABELS,
};

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AtivarButton({
  empresa,
  onAtualizado,
}: {
  empresa: EmpresaConectaComExtras;
  onAtualizado: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await ativarEmpresa(empresa.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onAtualizado();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        <Check className="size-4" />
        {empresa.status === "suspensa" ? "Reativar" : "Aprovar"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function SuspenderButton({
  empresa,
  onAtualizado,
}: {
  empresa: EmpresaConectaComExtras;
  onAtualizado: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await suspenderEmpresa(empresa.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onAtualizado();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        <Pause className="size-4" />
        Suspender
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function ExcluirEmpresaButton({
  empresa,
  onExcluida,
}: {
  empresa: EmpresaConectaComExtras;
  onExcluida: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirEmpresa(empresa.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onExcluida();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setConfirmacao("");
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="text-destructive">
            Excluir
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{empresa.nome_empresa}&quot;? Todas as vagas e
            notificações vinculadas também serão excluídas. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${empresa.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${empresa.id}`}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Digite EXCLUIR para confirmar"
            autoComplete="off"
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || confirmacao !== TEXTO_CONFIRMACAO_EXCLUSAO}
            onClick={handleExcluir}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EnviarNotificacaoDialog({ empresa }: { empresa: EmpresaConectaComExtras }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleEnviar() {
    setError(null);
    startTransition(async () => {
      const resultado = await enviarNotificacaoEmpresa(empresa.id, titulo, mensagem);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setEnviado(true);
      setTitulo("");
      setMensagem("");
      setTimeout(() => setOpen(false), 1200);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setError(null);
          setEnviado(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Bell className="size-4" />
            Notificar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar notificação</DialogTitle>
          <DialogDescription>Para &quot;{empresa.nome_empresa}&quot;.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`notif-titulo-${empresa.id}`}>Título</Label>
            <Input
              id={`notif-titulo-${empresa.id}`}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`notif-mensagem-${empresa.id}`}>Mensagem</Label>
            <Textarea
              id={`notif-mensagem-${empresa.id}`}
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {enviado && <p className="text-sm text-green-600 dark:text-green-400">Notificação enviada.</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={isPending || !titulo.trim() || !mensagem.trim()}
            onClick={handleEnviar}
          >
            {isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmpresaCard({
  empresa,
  onAtualizado,
  onExcluida,
}: {
  empresa: EmpresaConectaComExtras;
  onAtualizado: () => void;
  onExcluida: () => void;
}) {
  const whatsappDigitos = empresa.whatsapp?.replace(/\D/g, "");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="text-muted-foreground size-4" />
            <span className="font-medium">{empresa.nome_empresa}</span>
          </div>
          <Badge className={EMPRESA_STATUS_BADGE_CLASS[empresa.status]}>
            {EMPRESA_STATUS_LABELS[empresa.status]}
          </Badge>
        </div>
        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <span>Responsável: {empresa.nome_responsavel}</span>
          <span>{empresa.email}</span>
          {empresa.cnpj && <span>CNPJ: {empresa.cnpj}</span>}
          {(empresa.cidade || empresa.estado) && (
            <span>
              {empresa.cidade ?? "—"}/{empresa.estado ?? "—"}
            </span>
          )}
          {empresa.setor && <span>Setor: {empresa.setor}</span>}
          <span>
            {empresa.totalVagas} vaga{empresa.totalVagas === 1 ? "" : "s"}
          </span>
          <span>
            Último acesso: {empresa.ultimoAcesso ? formatDateBR(empresa.ultimoAcesso) : "nunca acessou"}
          </span>
          <span>Cadastrada em {formatDateBR(empresa.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {empresa.status !== "ativa" && <AtivarButton empresa={empresa} onAtualizado={onAtualizado} />}
          {empresa.status === "ativa" && <SuspenderButton empresa={empresa} onAtualizado={onAtualizado} />}
          {whatsappDigitos && (
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 dark:text-green-400"
              nativeButton={false}
              render={<a href={`https://wa.me/55${whatsappDigitos}`} target="_blank" rel="noreferrer" />}
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </Button>
          )}
          <EnviarNotificacaoDialog empresa={empresa} />
          <ExcluirEmpresaButton empresa={empresa} onExcluida={onExcluida} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ConectaView({ resultadoInicial }: { resultadoInicial: EmpresasConectaResultado }) {
  const [resultado, setResultado] = useState(resultadoInicial);
  const [statusFiltro, setStatusFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function carregar(overrides: { status?: Filtro; query?: string; page?: number }) {
    const novoStatus = overrides.status ?? statusFiltro;
    const novaQuery = overrides.query ?? busca;
    const novaPagina = overrides.page ?? pagina;

    startTransition(async () => {
      const atualizado = await getEmpresasConecta({
        query: novaQuery.trim() || undefined,
        status: novoStatus === "todas" ? undefined : novoStatus,
        page: novaPagina,
        limit: LIMITE_PADRAO,
      });
      setResultado(atualizado);
      setStatusFiltro(novoStatus);
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
          placeholder="Buscar por nome ou CNPJ..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((opcao) => (
          <Button
            key={opcao}
            type="button"
            variant={statusFiltro === opcao ? "default" : "outline"}
            size="sm"
            onClick={() => carregar({ status: opcao, page: 1 })}
          >
            {FILTRO_LABELS[opcao]}
          </Button>
        ))}
      </div>

      {resultado.empresas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma empresa encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resultado.empresas.map((empresa) => (
            <EmpresaCard
              key={empresa.id}
              empresa={empresa}
              onAtualizado={() => carregar({})}
              onExcluida={() => carregar({ page: 1 })}
            />
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
