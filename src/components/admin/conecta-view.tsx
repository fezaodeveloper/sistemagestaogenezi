"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  MessageCircle,
  Pause,
  Search,
} from "lucide-react";
import {
  ativarEmpresa,
  enviarNotificacaoEmpresa,
  excluirEmpresa,
  getEmpresasConecta,
  getVagasEmpresaAdmin,
  suspenderEmpresa,
} from "@/app/admin/conecta/actions";
import {
  EMPRESA_STATUS_BADGE_CLASS,
  EMPRESA_STATUS_LABELS,
  EMPRESA_STATUSES,
  VAGA_MODALIDADE_LABELS,
  VAGA_STATUS_BADGE_CLASS,
  VAGA_STATUS_LABELS,
  VAGA_TIPO_LABELS,
  type EmpresaConectaComExtras,
  type EmpresasConectaResultado,
  type VagaConecta,
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

// Mesmo padrão de LogoOuIniciais em conecta-vagas-view.tsx (portal do
// aluno) — fallback pro ícone Building2 quando a empresa não tem logo.
function LogoOuIniciais({ empresa }: { empresa: EmpresaConectaComExtras }) {
  if (empresa.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
      <img
        src={empresa.logo_url}
        alt={empresa.nome_empresa}
        className="size-8 shrink-0 rounded-md border object-contain"
      />
    );
  }
  return <Building2 className="text-muted-foreground size-4 shrink-0" />;
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

// Carrega as vagas da empresa só quando o card é expandido (mount = fetch,
// unmount ao recolher = descarta) — evita buscar vagas de empresa nenhuma
// tenha clicado pra ver.
function EmpresaDetalhesExpandidos({ empresa }: { empresa: EmpresaConectaComExtras }) {
  const [vagas, setVagas] = useState<VagaConecta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getVagasEmpresaAdmin(empresa.id)
      .then((resultado) => {
        if (!cancelado) setVagas(resultado);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar as vagas desta empresa.");
      });
    return () => {
      cancelado = true;
    };
  }, [empresa.id]);

  return (
    <div className="flex flex-col gap-3 border-t pt-3 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">CNPJ</p>
          <p>{empresa.cnpj ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Setor</p>
          <p>{empresa.setor ?? "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted-foreground">Endereço</p>
          <p className="flex items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            {empresa.endereco ?? "—"}
          </p>
        </div>
        {empresa.site && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Site</p>
            <a
              href={empresa.site}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 underline underline-offset-2"
            >
              <Globe className="size-3 shrink-0" />
              {empresa.site}
            </a>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium">Vagas desta empresa</p>
        {erro && <p className="text-destructive text-xs">{erro}</p>}
        {!erro && vagas === null && <p className="text-muted-foreground text-xs">Carregando...</p>}
        {vagas !== null && vagas.length === 0 && (
          <p className="text-muted-foreground text-xs">Nenhuma vaga publicada ainda.</p>
        )}
        {vagas !== null && vagas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {vagas.map((vaga) => (
              <div key={vaga.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  {vaga.titulo} · {VAGA_TIPO_LABELS[vaga.tipo]} · {VAGA_MODALIDADE_LABELS[vaga.modalidade]}
                </span>
                <Badge className={VAGA_STATUS_BADGE_CLASS[vaga.status]}>{VAGA_STATUS_LABELS[vaga.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
  const [expandido, setExpandido] = useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <button
          type="button"
          onClick={() => setExpandido((atual) => !atual)}
          className="flex items-start justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2">
            <LogoOuIniciais empresa={empresa} />
            <span className="font-medium">{empresa.nome_empresa}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={EMPRESA_STATUS_BADGE_CLASS[empresa.status]}>
              {EMPRESA_STATUS_LABELS[empresa.status]}
            </Badge>
            {expandido ? (
              <ChevronUp className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            )}
          </div>
        </button>
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
        {expandido && <EmpresaDetalhesExpandidos empresa={empresa} />}
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
