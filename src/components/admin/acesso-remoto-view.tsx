"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Eye, EyeOff, Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarAcessoRemoto,
  criarAcessoRemoto,
  excluirAcessoRemoto,
  getAcessosRemotos,
} from "@/app/admin/acesso-remoto/actions";
import type { AcessoRemoto } from "@/lib/acesso-remoto/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

// Usado tanto pra exibir login/senha já salvos (mascarados por padrão, com
// olho pra revelar) quanto o botão de copiar — nunca aparece em URL/log:
// o valor já chega pronto via props, lido de FormData/props de servidor,
// nunca via query string.
function CampoSegredo({ label, valor }: { label: string; valor: string }) {
  const [visivel, setVisivel] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Best-effort — clipboard pode ser bloqueado pelo navegador/permissão.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="truncate font-mono text-sm">{visivel ? valor : "••••••••"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={visivel ? `Ocultar ${label}` : `Mostrar ${label}`}
          onClick={() => setVisivel((atual) => !atual)}
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Copiar ${label}`}
          onClick={handleCopiar}
        >
          {copiado ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

// Campo de senha do formulário (criar/editar) — diferente de CampoSegredo
// acima, que só exibe um valor já salvo: aqui o valor é digitado, mascarado
// por padrão como qualquer input type="password".
function CampoSenhaInput({ id, defaultValue }: { id: string; defaultValue?: string }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <Input id={id} name="senha" type={visivel ? "text" : "password"} defaultValue={defaultValue} className="pr-10" required />
      <button
        type="button"
        onClick={() => setVisivel((atual) => !atual)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function AcessoRemotoFormFields({ acesso }: { acesso?: AcessoRemoto }) {
  const [ativo, setAtivo] = useState(acesso?.ativo ?? true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome_pc">Nome do PC</Label>
        <Input id="nome_pc" name="nome_pc" defaultValue={acesso?.nome_pc} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ip">IP</Label>
        <Input id="ip" name="ip" defaultValue={acesso?.ip ?? ""} placeholder="Opcional" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login">Login</Label>
        <Input id="login" name="login" defaultValue={acesso?.login} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Senha</Label>
        <CampoSenhaInput id="senha" defaultValue={acesso?.senha} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" defaultValue={acesso?.observacoes ?? ""} placeholder="Opcional" rows={3} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="ativo" className="font-normal">
          Ativo
        </Label>
        <Switch id="ativo" name="ativo" checked={ativo} onCheckedChange={setAtivo} />
      </div>
    </div>
  );
}

function NovoAcessoRemotoDialog({ onSalvo }: { onSalvo: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarAcessoRemoto(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button><Plus />Novo acesso</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo acesso remoto</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <AcessoRemotoFormFields />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Criar acesso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarAcessoRemotoDialog({ acesso, onSalvo }: { acesso: AcessoRemoto; onSalvo: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarAcessoRemoto(acesso.id, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar acesso remoto">
            <Pencil />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar acesso remoto</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <AcessoRemotoFormFields acesso={acesso} />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirAcessoRemotoButton({ acesso, onExcluido }: { acesso: AcessoRemoto; onExcluido: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirAcessoRemoto(acesso.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onExcluido();
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            aria-label="Excluir acesso remoto"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir acesso remoto</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{acesso.nome_pc}&quot;? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${acesso.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${acesso.id}`}
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

function AcessoRemotoCard({
  acesso,
  onSalvo,
  onExcluido,
}: {
  acesso: AcessoRemoto;
  onSalvo: () => void;
  onExcluido: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Monitor className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <CardTitle className="truncate">{acesso.nome_pc}</CardTitle>
            {acesso.ip && <p className="text-muted-foreground text-xs">{acesso.ip}</p>}
          </div>
        </div>
        <Badge
          className={
            acesso.ativo
              ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }
        >
          {acesso.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <CampoSegredo label="Login" valor={acesso.login} />
        <CampoSegredo label="Senha" valor={acesso.senha} />
        {acesso.observacoes && <p className="text-muted-foreground text-xs">{acesso.observacoes}</p>}
        <div className="flex justify-end gap-1">
          <EditarAcessoRemotoDialog acesso={acesso} onSalvo={onSalvo} />
          <ExcluirAcessoRemotoButton acesso={acesso} onExcluido={onExcluido} />
        </div>
      </CardContent>
    </Card>
  );
}

export function AcessoRemotoView({ acessosIniciais }: { acessosIniciais: AcessoRemoto[] }) {
  const [acessos, setAcessos] = useState(acessosIniciais);
  const [busca, setBusca] = useState("");
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const resultado = await getAcessosRemotos();
      setAcessos(resultado);
    });
  }

  function handleExcluido(id: string) {
    setAcessos((prev) => prev.filter((acesso) => acesso.id !== id));
  }

  const acessosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return acessos;
    return acessos.filter((acesso) => acesso.nome_pc.toLowerCase().includes(termo));
  }, [acessos, busca]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Buscar por nome do PC..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />
        <NovoAcessoRemotoDialog onSalvo={recarregar} />
      </div>

      {acessosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {acessos.length === 0
              ? "Nenhum acesso remoto cadastrado ainda."
              : "Nenhum acesso encontrado com o filtro aplicado."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {acessosFiltrados.map((acesso) => (
            <AcessoRemotoCard
              key={acesso.id}
              acesso={acesso}
              onSalvo={recarregar}
              onExcluido={() => handleExcluido(acesso.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
