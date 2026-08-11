"use client";

import { useState, useTransition } from "react";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

export function ResgateItemCard({
  titulo,
  descricao,
  custoCreditos,
  imagemUrl,
  bloqueado,
  motivoBloqueio,
  onConfirmar,
}: {
  titulo: string;
  descricao?: string | null;
  custoCreditos: number;
  imagemUrl?: string | null;
  bloqueado?: boolean;
  motivoBloqueio?: string;
  onConfirmar: () => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resgatado, setResgatado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    startTransition(async () => {
      const result = await onConfirmar();
      if (result.error) {
        setError(result.error);
      } else {
        setResgatado(true);
        setOpen(false);
      }
    });
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      {imagemUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- foto de catálogo em bucket público, sem necessidade de otimização do next/image
        <img src={imagemUrl} alt={titulo} className="h-40 w-full object-cover" />
      )}
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {descricao && <p className="text-muted-foreground text-sm">{descricao}</p>}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="gap-1">
          <Coins className="size-3.5" />
          {custoCreditos}
        </Badge>

        {resgatado ? (
          <Badge variant="default">Resgatado</Badge>
        ) : (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
              render={
                <Button size="sm" disabled={bloqueado}>
                  Resgatar
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar resgate</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai gastar {custoCreditos} crédito(s) pra resgatar &quot;{titulo}&quot;. Essa
                  ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={isPending} onClick={handleConfirmar}>
                  {isPending ? "Resgatando..." : "Confirmar resgate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
      {bloqueado && motivoBloqueio && (
        <p className="text-muted-foreground px-6 pb-4 text-xs">{motivoBloqueio}</p>
      )}
    </Card>
  );
}
