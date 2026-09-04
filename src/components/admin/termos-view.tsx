"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { atualizarTermo, criarTermo, excluirTermo, getTermos } from "@/app/admin/termos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { TERMO_TIPOS, TERMO_TIPO_LABELS, type Termo } from "@/lib/termos/schema";

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

// "21/08/2026 às 14:32" — mesmo formato usado em outras telas do admin
// (ver premios/page.tsx, contratos-view.tsx).
function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

function EditarTermoDialog({
  termo,
  onSalvo,
}: {
  termo: Termo;
  onSalvo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<string>(termo.tipo);
  const [ativo, setAtivo] = useState(termo.ativo);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTipo(termo.tipo);
      setAtivo(termo.ativo);
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarTermo(termo.id, formData);
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
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar termo">
            <Pencil />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar termo</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`titulo-${termo.id}`}>Título</Label>
            <Input id={`titulo-${termo.id}`} name="titulo" defaultValue={termo.titulo} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`tipo-${termo.id}`}>Tipo</Label>
            <Select
              name="tipo"
              items={TERMO_TIPO_LABELS}
              value={tipo}
              onValueChange={(value) => setTipo(value as string)}
            >
              <SelectTrigger id={`tipo-${termo.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMO_TIPOS.map((tipoOpcao) => (
                  <SelectItem key={tipoOpcao} value={tipoOpcao}>
                    {TERMO_TIPO_LABELS[tipoOpcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`conteudo-${termo.id}`}>Conteúdo</Label>
            <Textarea id={`conteudo-${termo.id}`} name="conteudo" defaultValue={termo.conteudo} rows={8} required />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`ativo-${termo.id}`} className="font-normal">
              Ativo
            </Label>
            <Switch id={`ativo-${termo.id}`} name="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
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

function ExcluirTermoButton({ termo, onExcluido }: { termo: Termo; onExcluido: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirTermo(termo.id);
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
            aria-label="Excluir termo"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir termo</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{termo.titulo}&quot;? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${termo.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${termo.id}`}
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

function NovoTermoDialog({ onCriado }: { onCriado: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<string>("");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTipo("");
      setAtivo(true);
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarTermo(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onCriado();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Novo termo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo termo</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select name="tipo" items={TERMO_TIPO_LABELS} value={tipo} onValueChange={(value) => setTipo(value as string)}>
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TERMO_TIPOS.map((tipoOpcao) => (
                  <SelectItem key={tipoOpcao} value={tipoOpcao}>
                    {TERMO_TIPO_LABELS[tipoOpcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="conteudo">Conteúdo</Label>
            <Textarea id="conteudo" name="conteudo" rows={8} placeholder="Texto do termo" required />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ativo" className="font-normal">
              Ativo
            </Label>
            <Switch id="ativo" name="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !tipo}>
              {isPending ? "Salvando..." : "Criar termo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TermosView({ termosIniciais }: { termosIniciais: Termo[] }) {
  const [termos, setTermos] = useState(termosIniciais);
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const resultado = await getTermos();
      setTermos(resultado);
    });
  }

  function handleExcluido(id: string) {
    setTermos((prev) => prev.filter((termo) => termo.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NovoTermoDialog onCriado={recarregar} />
      </div>

      {termos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhum termo cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {termos.map((termo) => (
              <TableRow key={termo.id}>
                <TableCell className="font-medium">{termo.titulo}</TableCell>
                <TableCell>{TERMO_TIPO_LABELS[termo.tipo]}</TableCell>
                <TableCell>
                  <Badge variant={termo.ativo ? "default" : "outline"}>{termo.ativo ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell>{formatDataHora(termo.created_at)}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <EditarTermoDialog termo={termo} onSalvo={recarregar} />
                  <ExcluirTermoButton termo={termo} onExcluido={() => handleExcluido(termo.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
