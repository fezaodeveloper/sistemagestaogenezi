"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { getPdfSignedUrlAdmin } from "@/app/admin/professor/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ViewerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; url: string };

// Variante admin de PdfViewerButton (src/components/aluno/), pro painel
// do professor — mesmo componente visual, só troca a Server Action de
// origem da signed URL.
export function PdfViewerButtonAdmin({ materialId, titulo }: { materialId: string; titulo: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ViewerState>({ status: "idle" });
  const [, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || state.status !== "idle") return;

    setState({ status: "loading" });
    startTransition(async () => {
      const result = await getPdfSignedUrlAdmin(materialId);
      setState(
        "error" in result
          ? { status: "error", message: result.error }
          : { status: "ready", url: result.url },
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <FileText />
        {titulo}
      </DialogTrigger>
      <DialogContent className="flex h-[85vh] w-full flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg">
          {state.status === "error" ? (
            <div className="text-destructive flex h-full items-center justify-center text-center text-sm">
              {state.message}
            </div>
          ) : state.status === "ready" ? (
            <iframe
              className="h-full w-full"
              src={`${state.url}#toolbar=0&navpanes=0`}
              title={titulo}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
