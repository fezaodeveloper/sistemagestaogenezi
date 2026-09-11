"use client";

import { useState, useTransition } from "react";
import { Bell, Building2, Check, Pause } from "lucide-react";
import {
  aprovarEmpresa,
  enviarNotificacaoEmpresa,
  excluirEmpresa,
  getEmpresasConecta,
  suspenderEmpresa,
} from "@/app/admin/conecta/actions";
import {
  EMPRESA_STATUS_BADGE_CLASS,
  EMPRESA_STATUS_LABELS,
  EMPRESA_STATUSES,
  type EmpresaConecta,
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
import { Textarea } from "@/components/ui/textarea";

const FILTROS = ["todas", ...EMPRESA_STATUSES] as const;
type Filtro = (typeof FILTROS)[number];

const FILTRO_LABELS: Record<Filtro, string> = {
  todas: "Todas",
  ...EMPRESA_STATUS_LABELS,
};

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AprovarButton({ empresa, onAtualizado }: { empresa: EmpresaConecta; onAtualizado: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await aprovarEmpresa(empresa.id);
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
        Aprovar
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function SuspenderButton({ empresa, onAtualizado }: { empresa: EmpresaConecta; onAtualizado: () => void }) {
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

function ExcluirEmpresaButton({ empresa, onExcluida }: { empresa: EmpresaConecta; onExcluida: () => void }) {
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

function EnviarNotificacaoDialog({ empresa }: { empresa: EmpresaConecta }) {
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
  empresa: EmpresaConecta;
  onAtualizado: () => void;
  onExcluida: () => void;
}) {
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
          {empresa.whatsapp && <span>WhatsApp: {empresa.whatsapp}</span>}
          {(empresa.cidade || empresa.estado) && (
            <span>
              {empresa.cidade ?? "—"}/{empresa.estado ?? "—"}
            </span>
          )}
          {empresa.setor && <span>Setor: {empresa.setor}</span>}
          <span>Cadastrada em {formatDateBR(empresa.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {empresa.status !== "ativa" && <AprovarButton empresa={empresa} onAtualizado={onAtualizado} />}
          {empresa.status === "ativa" && <SuspenderButton empresa={empresa} onAtualizado={onAtualizado} />}
          <EnviarNotificacaoDialog empresa={empresa} />
          <ExcluirEmpresaButton empresa={empresa} onExcluida={onExcluida} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ConectaView({ empresasIniciais }: { empresasIniciais: EmpresaConecta[] }) {
  const [empresas, setEmpresas] = useState(empresasIniciais);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const atualizado = await getEmpresasConecta();
      setEmpresas(atualizado);
    });
  }

  const empresasFiltradas =
    filtro === "todas" ? empresas : empresas.filter((empresa) => empresa.status === filtro);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((opcao) => (
          <Button
            key={opcao}
            type="button"
            variant={filtro === opcao ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltro(opcao)}
          >
            {FILTRO_LABELS[opcao]}
          </Button>
        ))}
      </div>

      {empresasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma empresa {filtro === "todas" ? "cadastrada ainda" : `com status "${FILTRO_LABELS[filtro]}"`}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {empresasFiltradas.map((empresa) => (
            <EmpresaCard
              key={empresa.id}
              empresa={empresa}
              onAtualizado={recarregar}
              onExcluida={recarregar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
