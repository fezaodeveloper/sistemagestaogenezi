"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { enviarMensagemEmMassa } from "@/app/admin/chat/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AlunoElegivelChat } from "@/lib/chat/chat";

export function MensagemEmMassaDialog({ alunos }: { alunos: AlunoElegivelChat[] }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mensagem, setMensagem] = useState("");
  const [resultado, setResultado] = useState<{ enviadas: number; falhas: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timeoutId = setTimeout(() => setTermoDebounced(busca.trim().toLowerCase()), 300);
    return () => clearTimeout(timeoutId);
  }, [busca]);

  const alunosFiltrados = useMemo(() => {
    if (!termoDebounced) return alunos;
    return alunos.filter((aluno) => {
      const nome = (aluno.nome ?? "").toLowerCase();
      const email = (aluno.email ?? "").toLowerCase();
      return nome.includes(termoDebounced) || email.includes(termoDebounced);
    });
  }, [alunos, termoDebounced]);

  const todosSelecionados = alunos.length > 0 && alunos.every((aluno) => selecionados.has(aluno.id));

  function toggleAluno(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(alunos.map((aluno) => aluno.id)));
  }

  function handleEnviar() {
    setResultado(null);
    startTransition(async () => {
      const resultadoEnvio = await enviarMensagemEmMassa([...selecionados], mensagem);
      setResultado(resultadoEnvio);
      if (resultadoEnvio.falhas === 0) {
        setMensagem("");
        setSelecionados(new Set());
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setResultado(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Megaphone />
            Mensagem em massa
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mensagem em massa</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input placeholder="Buscar aluno..." value={busca} onChange={(event) => setBusca(event.target.value)} />

          <div className="flex items-center gap-2 border-b pb-3">
            <Checkbox id="selecionar_todos_massa" checked={todosSelecionados} onCheckedChange={toggleTodos} />
            <Label htmlFor="selecionar_todos_massa" className="text-sm font-normal">
              Selecionar todos os alunos ativos ({alunos.length})
            </Label>
          </div>

          <div className="flex max-h-56 flex-col overflow-y-auto rounded-md border">
            {alunosFiltrados.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">Nenhum aluno encontrado.</p>
            ) : (
              alunosFiltrados.map((aluno) => (
                <label
                  key={aluno.id}
                  className="hover:bg-muted flex items-center gap-2 border-b p-2.5 text-sm last:border-b-0"
                >
                  <Checkbox checked={selecionados.has(aluno.id)} onCheckedChange={() => toggleAluno(aluno.id)} />
                  <div className="flex flex-col">
                    <span className="font-medium">{aluno.nome ?? "Aluno"}</span>
                    <span className="text-muted-foreground text-xs">{aluno.email ?? "—"}</span>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mensagem_massa">Mensagem</Label>
            <Textarea
              id="mensagem_massa"
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              rows={4}
              placeholder="Escreva a mensagem..."
            />
          </div>

          {resultado && (
            <p className={resultado.falhas > 0 ? "text-destructive text-sm" : "text-sm text-green-600"}>
              {resultado.enviadas} mensagem{resultado.enviadas === 1 ? "" : "s"} enviada
              {resultado.enviadas === 1 ? "" : "s"}
              {resultado.falhas > 0 ? `, ${resultado.falhas} falha(s).` : "."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={selecionados.size === 0 || mensagem.trim().length === 0 || isPending}
            onClick={handleEnviar}
          >
            {isPending ? "Enviando..." : `Enviar para ${selecionados.size} aluno${selecionados.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
