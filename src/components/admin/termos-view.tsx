"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { excluirTermo, gerarTermoPdf } from "@/app/admin/termos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TERMO_TIPO_LABELS, type Termo } from "@/lib/termos/schema";

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

// Abre a aba em branco já no clique (síncrono), antes do await — mesmo
// padrão de handleImprimirComprovante em matricula-detalhes.tsx — evita
// bloqueio de pop-up em navegadores que só permitem window.open() disparado
// direto por um evento de clique.
function VisualizarPdfButton({ termoId }: { termoId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const novaAba = window.open("", "_blank");
    startTransition(async () => {
      const resultado = await gerarTermoPdf(termoId);
      if ("error" in resultado) {
        novaAba?.close();
        window.alert(resultado.error);
        return;
      }
      const byteCharacters = atob(resultado.pdf);
      const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Visualizar PDF"
      disabled={isPending}
      onClick={handleClick}
    >
      <FileText />
    </Button>
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

export function TermosView({ termosIniciais }: { termosIniciais: Termo[] }) {
  const [termos, setTermos] = useState(termosIniciais);

  function handleExcluido(id: string) {
    setTermos((prev) => prev.filter((termo) => termo.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button render={<Link href="/admin/termos/novo" />} nativeButton={false}>
          <Plus />
          Novo termo
        </Button>
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
                  <VisualizarPdfButton termoId={termo.id} />
                  <Button
                    render={<Link href={`/admin/termos/${termo.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editar termo"
                  >
                    <Pencil />
                  </Button>
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
