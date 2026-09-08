"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  criarRecompensa,
  excluirRecompensa,
  type BadgeComRecompensas,
  type OpcaoRecompensa,
} from "@/app/admin/engajamento/recompensas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const TIPO_ITEMS: Record<string, string> = { premio: "Prêmio", curso: "Curso" };

function AdicionarRecompensaDialog({
  badge,
  premios,
  cursos,
  onCriado,
}: {
  badge: BadgeComRecompensas;
  premios: OpcaoRecompensa[];
  cursos: OpcaoRecompensa[];
  onCriado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<string>("premio");
  const [premioId, setPremioId] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTipo("premio");
      setPremioId("");
      setCursoId("");
      setError(null);
    }
  }

  const premioSelecionado = premios.find((p) => p.id === premioId);
  const mostrarPrazoEntrega =
    tipo === "premio" &&
    (premioSelecionado?.tipoPremio === "fisico" || premioSelecionado?.tipoPremio === "hibrido");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarRecompensa(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onCriado();
    });
  }

  const premioItems = Object.fromEntries(premios.map((p) => [p.id, p.nome]));
  const cursoItems = Object.fromEntries(cursos.map((c) => [c.id, c.nome]));
  const podeSalvar = tipo === "premio" ? !!premioId : !!cursoId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <Plus />
            Adicionar recompensa
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Nova recompensa — {badge.icone} {badge.nome}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="badge_id" value={badge.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`tipo-${badge.id}`}>Tipo</Label>
            <Select
              name="tipo"
              items={TIPO_ITEMS}
              value={tipo}
              onValueChange={(value) => setTipo(value as string)}
            >
              <SelectTrigger id={`tipo-${badge.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premio">Prêmio</SelectItem>
                <SelectItem value="curso">Curso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "premio" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`premio-${badge.id}`}>Prêmio</Label>
              <Select
                name="premio_id"
                items={premioItems}
                value={premioId}
                onValueChange={(value) => setPremioId(value as string)}
              >
                <SelectTrigger id={`premio-${badge.id}`} className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {premios.map((premio) => (
                    <SelectItem key={premio.id} value={premio.id}>
                      {premio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {premios.length === 0 && (
                <p className="text-muted-foreground text-xs">Nenhum prêmio ativo cadastrado.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`curso-${badge.id}`}>Curso</Label>
              <Select
                name="curso_id"
                items={cursoItems}
                value={cursoId}
                onValueChange={(value) => setCursoId(value as string)}
              >
                <SelectTrigger id={`curso-${badge.id}`} className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((curso) => (
                    <SelectItem key={curso.id} value={curso.id}>
                      {curso.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cursos.length === 0 && (
                <p className="text-muted-foreground text-xs">Nenhum curso ativo cadastrado.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`descricao-${badge.id}`}>Descrição</Label>
            <Input id={`descricao-${badge.id}`} name="descricao_recompensa" placeholder="Opcional" />
          </div>

          {mostrarPrazoEntrega && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`prazo-${badge.id}`}>Prazo de entrega (dias)</Label>
              <Input
                id={`prazo-${badge.id}`}
                name="prazo_entrega_dias"
                type="number"
                min={1}
                defaultValue={7}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !podeSalvar}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirRecompensaButton({
  recompensaId,
  nomeItem,
  onExcluido,
}: {
  recompensaId: string;
  nomeItem: string;
  onExcluido: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirRecompensa(recompensaId);
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
            aria-label={`Remover recompensa ${nomeItem}`}
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover recompensa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover o vínculo com &quot;{nomeItem}&quot;? Isso não afeta
            recompensas já concedidas a alunos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
            {isPending ? "Removendo..." : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RecompensasMedalhasView({
  badges,
  premios,
  cursos,
}: {
  badges: BadgeComRecompensas[];
  premios: OpcaoRecompensa[];
  cursos: OpcaoRecompensa[];
}) {
  const router = useRouter();

  function handleMudou() {
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Medalha</TableHead>
          <TableHead>Recompensas vinculadas</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {badges.map((badge) => (
          <TableRow key={badge.id}>
            <TableCell className="align-top font-medium">
              <span className="mr-1.5">{badge.icone}</span>
              {badge.nome}
            </TableCell>
            <TableCell className="align-top">
              {badge.recompensas.length === 0 ? (
                <span className="text-muted-foreground text-sm">Nenhuma</span>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {badge.recompensas.map((recompensa) => (
                    <div key={recompensa.id} className="flex items-center gap-2">
                      <Badge variant="outline">
                        {recompensa.tipo === "premio" ? "Prêmio" : "Curso"}
                      </Badge>
                      <span className="text-sm">{recompensa.nomeItem}</span>
                      {recompensa.descricaoRecompensa && (
                        <span className="text-muted-foreground text-xs">
                          — {recompensa.descricaoRecompensa}
                        </span>
                      )}
                      {recompensa.prazoEntregaDias && (
                        <span className="text-muted-foreground text-xs">
                          (prazo: {recompensa.prazoEntregaDias}d)
                        </span>
                      )}
                      <ExcluirRecompensaButton
                        recompensaId={recompensa.id}
                        nomeItem={recompensa.nomeItem}
                        onExcluido={handleMudou}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell className="align-top text-right">
              <AdicionarRecompensaDialog
                badge={badge}
                premios={premios}
                cursos={cursos}
                onCriado={handleMudou}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
