"use client";

import { useState, useTransition } from "react";
import { Copy, Pause, Play, Plus, Square, Trash2 } from "lucide-react";
import {
  atualizarStatusVaga,
  atualizarVaga,
  criarVaga,
  duplicarVaga,
  excluirVaga,
} from "@/app/empresa/(protegido)/vagas/actions";
import {
  VAGA_MODALIDADE_LABELS,
  VAGA_MODALIDADES,
  VAGA_TIPO_LABELS,
  VAGA_TIPOS,
  type CidadeConecta,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const TIPO_ITEMS = Object.fromEntries(VAGA_TIPOS.map((tipo) => [tipo, VAGA_TIPO_LABELS[tipo]]));
const MODALIDADE_ITEMS = Object.fromEntries(
  VAGA_MODALIDADES.map((modalidade) => [modalidade, VAGA_MODALIDADE_LABELS[modalidade]]),
);

function VagaFormFields({ vaga, cidades }: { vaga?: VagaConecta; cidades: CidadeConecta[] }) {
  const [salarioOculto, setSalarioOculto] = useState(vaga?.salario_oculto ?? false);
  const cidadeInicial = vaga ? cidades.find((c) => c.nome === vaga.cidade && c.estado === vaga.estado) : undefined;
  const [cidadeId, setCidadeId] = useState(cidadeInicial?.id ?? "");
  const cidadeSelecionada = cidades.find((c) => c.id === cidadeId);
  const cidadesSE = cidades.filter((c) => c.estado === "SE");
  const cidadesAL = cidades.filter((c) => c.estado === "AL");
  const CIDADE_ITEMS = Object.fromEntries(cidades.map((c) => [c.id, `${c.nome}/${c.estado}`]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo">Título da vaga</Label>
        <Input id="titulo" name="titulo" defaultValue={vaga?.titulo} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" items={TIPO_ITEMS} defaultValue={vaga?.tipo ?? "emprego"}>
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAGA_TIPOS.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {VAGA_TIPO_LABELS[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="modalidade">Modalidade</Label>
          <Select name="modalidade" items={MODALIDADE_ITEMS} defaultValue={vaga?.modalidade ?? "presencial"}>
            <SelectTrigger id="modalidade" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAGA_MODALIDADES.map((modalidade) => (
                <SelectItem key={modalidade} value={modalidade}>
                  {VAGA_MODALIDADE_LABELS[modalidade]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cidade_id">Cidade</Label>
        <Select
          items={CIDADE_ITEMS}
          value={cidadeId}
          onValueChange={(value) => setCidadeId(value ?? "")}
        >
          <SelectTrigger id="cidade_id" className="w-full">
            <SelectValue placeholder="Selecione a cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Sergipe</SelectLabel>
              {cidadesSE.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Alagoas</SelectLabel>
              {cidadesAL.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <input type="hidden" name="cidade" value={cidadeSelecionada?.nome ?? ""} />
        <input type="hidden" name="estado" value={cidadeSelecionada?.estado ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Descrição da vaga</Label>
        <Textarea id="descricao" name="descricao" rows={4} defaultValue={vaga?.descricao} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="requisitos">Requisitos (opcional)</Label>
        <Textarea id="requisitos" name="requisitos" rows={3} defaultValue={vaga?.requisitos ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="salario_min">Salário mínimo (opcional)</Label>
          <Input
            id="salario_min"
            name="salario_min"
            type="number"
            min={0}
            defaultValue={vaga?.salario_min ?? undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="salario_max">Salário máximo (opcional)</Label>
          <Input
            id="salario_max"
            name="salario_max"
            type="number"
            min={0}
            defaultValue={vaga?.salario_max ?? undefined}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="salario_oculto" name="salario_oculto" checked={salarioOculto} onCheckedChange={setSalarioOculto} />
        <Label htmlFor="salario_oculto" className="font-normal">
          Ocultar salário
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="carga_horaria">Carga horária (opcional)</Label>
          <Input
            id="carga_horaria"
            name="carga_horaria"
            placeholder="8h/dia, 44h/semana"
            defaultValue={vaga?.carga_horaria ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="prazo_candidatura">Prazo para candidatura (opcional)</Label>
          <Input
            id="prazo_candidatura"
            name="prazo_candidatura"
            type="date"
            defaultValue={vaga?.prazo_candidatura ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

function NovaVagaDialog({ onSalvo, cidades }: { onSalvo: () => void; cidades: CidadeConecta[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarVaga(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button">
            <Plus className="size-4" />
            Publicar nova vaga
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publicar nova vaga</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <VagaFormFields cidades={cidades} />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Publicando..." : "Publicar vaga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarVagaDialog({
  vaga,
  onSalvo,
  cidades,
}: {
  vaga: VagaConecta;
  onSalvo: () => void;
  cidades: CidadeConecta[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarVaga(vaga.id, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm">Editar</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar vaga</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <VagaFormFields vaga={vaga} cidades={cidades} />
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

function StatusVagaButton({
  vaga,
  status,
  label,
  icon,
  colorClassName,
  onAtualizado,
}: {
  vaga: VagaConecta;
  status: VagaConecta["status"];
  label: string;
  icon: React.ReactNode;
  colorClassName: string;
  onAtualizado: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await atualizarStatusVaga(vaga.id, status);
      onAtualizado();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
      className={colorClassName}
    >
      {icon}
      {label}
    </Button>
  );
}

function DuplicarVagaButton({ vaga, onSalvo }: { vaga: VagaConecta; onSalvo: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDuplicar() {
    setError(null);
    startTransition(async () => {
      const resultado = await duplicarVaga(vaga.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Copy className="size-4" />
            Duplicar
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicar vaga</AlertDialogTitle>
          <AlertDialogDescription>
            Isso cria uma nova vaga ativa com os mesmos dados de &quot;{vaga.titulo}&quot;, com o título
            &quot;{vaga.titulo} (cópia)&quot;.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleDuplicar}>
            {isPending ? "Duplicando..." : "Duplicar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function ExcluirVagaButton({ vaga, onExcluida }: { vaga: VagaConecta; onExcluida: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirVaga(vaga.id);
      if ("error" in resultado) {
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
            <Trash2 className="size-4" />
            Excluir
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir vaga</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{vaga.titulo}&quot;? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-vaga-${vaga.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-vaga-${vaga.id}`}
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

function VagaCard({
  vaga,
  onAtualizado,
  cidades,
}: {
  vaga: VagaConecta;
  onAtualizado: () => void;
  cidades: CidadeConecta[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{vaga.titulo}</span>
          <Badge variant="outline">{vaga.status}</Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {vaga.cidade}/{vaga.estado} · {VAGA_MODALIDADE_LABELS[vaga.modalidade]} ·{" "}
          {VAGA_TIPO_LABELS[vaga.tipo]}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <EditarVagaDialog vaga={vaga} onSalvo={onAtualizado} cidades={cidades} />
          {vaga.status === "ativa" && (
            <StatusVagaButton
              vaga={vaga}
              status="pausada"
              label="Pausar"
              icon={<Pause className="size-4" />}
              colorClassName="text-amber-600 dark:text-amber-400"
              onAtualizado={onAtualizado}
            />
          )}
          {vaga.status === "pausada" && (
            <StatusVagaButton
              vaga={vaga}
              status="ativa"
              label="Ativar"
              icon={<Play className="size-4" />}
              colorClassName="text-green-600 dark:text-green-400"
              onAtualizado={onAtualizado}
            />
          )}
          {vaga.status !== "encerrada" && (
            <StatusVagaButton
              vaga={vaga}
              status="encerrada"
              label="Encerrar"
              icon={<Square className="size-4" />}
              colorClassName="text-destructive"
              onAtualizado={onAtualizado}
            />
          )}
          <DuplicarVagaButton vaga={vaga} onSalvo={onAtualizado} />
          <ExcluirVagaButton vaga={vaga} onExcluida={onAtualizado} />
        </div>
      </CardContent>
    </Card>
  );
}

export function VagasView({
  vagasIniciais,
  recarregarAction,
  cidadesAprovadas,
}: {
  vagasIniciais: VagaConecta[];
  recarregarAction: () => Promise<VagaConecta[]>;
  cidadesAprovadas: CidadeConecta[];
}) {
  const [vagas, setVagas] = useState(vagasIniciais);
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const atualizado = await recarregarAction();
      setVagas(atualizado);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Minhas vagas</h1>
          <p className="text-muted-foreground text-sm">Vagas publicadas pela sua empresa.</p>
        </div>
        <NovaVagaDialog onSalvo={recarregar} cidades={cidadesAprovadas} />
      </div>

      {vagas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma vaga publicada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vagas.map((vaga) => (
            <VagaCard key={vaga.id} vaga={vaga} onAtualizado={recarregar} cidades={cidadesAprovadas} />
          ))}
        </div>
      )}
    </div>
  );
}
