"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  adicionarCidade,
  excluirCidade,
  getCidadesAdmin,
  toggleCidadeAtiva,
} from "@/app/admin/conecta/cidades/actions";
import {
  CIDADE_ESTADO_BADGE_CLASS,
  CIDADE_ESTADO_LABELS,
  CIDADE_ESTADOS,
  type CidadeConecta,
  type CidadeEstado,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const ESTADO_ITEMS = Object.fromEntries(CIDADE_ESTADOS.map((estado) => [estado, CIDADE_ESTADO_LABELS[estado]]));

function AdicionarCidadeDialog({ onAdicionada }: { onAdicionada: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState<CidadeEstado>("SE");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSalvar() {
    setError(null);
    startTransition(async () => {
      const resultado = await adicionarCidade(nome, estado);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setNome("");
      setEstado("SE");
      setOpen(false);
      onAdicionada();
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
            Adicionar cidade
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar cidade</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome-cidade">Nome da cidade</Label>
            <Input id="nome-cidade" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado-cidade">Estado</Label>
            <Select items={ESTADO_ITEMS} value={estado} onValueChange={(value) => setEstado((value as CidadeEstado) || "SE")}>
              <SelectTrigger id="estado-cidade" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CIDADE_ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {CIDADE_ESTADO_LABELS[uf]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" disabled={isPending || !nome.trim()} onClick={handleSalvar}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleAtivaSwitch({ cidade, onAtualizada }: { cidade: CidadeConecta; onAtualizada: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(valor: boolean) {
    startTransition(async () => {
      await toggleCidadeAtiva(cidade.id, valor);
      onAtualizada();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={cidade.ativa} onCheckedChange={handleChange} disabled={isPending} />
      <span className="text-muted-foreground text-xs">{cidade.ativa ? "Ativa" : "Inativa"}</span>
    </div>
  );
}

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function ExcluirCidadeButton({ cidade, onExcluida }: { cidade: CidadeConecta; onExcluida: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirCidade(cidade.id);
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
            <Trash2 className="size-4" />
            Excluir
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cidade</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{cidade.nome}&quot;? Vagas já cadastradas nessa cidade não são
            afetadas, mas ela deixa de aparecer nas opções para novas vagas. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-cidade-${cidade.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-cidade-${cidade.id}`}
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

export function ConectaCidadesView({ cidadesIniciais }: { cidadesIniciais: CidadeConecta[] }) {
  const [cidades, setCidades] = useState(cidadesIniciais);
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const atualizado = await getCidadesAdmin();
      setCidades(atualizado);
    });
  }

  const gruposPorEstado = CIDADE_ESTADOS.map((estado) => ({
    estado,
    cidades: cidades.filter((cidade) => cidade.estado === estado),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <AdicionarCidadeDialog onAdicionada={recarregar} />
      </div>

      {cidades.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma cidade cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {gruposPorEstado.map(
            ({ estado, cidades: lista }) =>
              lista.length > 0 && (
                <div key={estado} className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold">{CIDADE_ESTADO_LABELS[estado]}</h2>
                  <div className="flex flex-col gap-2">
                    {lista.map((cidade) => (
                      <Card key={cidade.id}>
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="flex items-center gap-2">
                            <Badge className={CIDADE_ESTADO_BADGE_CLASS[cidade.estado]}>{cidade.estado}</Badge>
                            <span className="font-medium">{cidade.nome}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <ToggleAtivaSwitch cidade={cidade} onAtualizada={recarregar} />
                            <ExcluirCidadeButton cidade={cidade} onExcluida={recarregar} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}
