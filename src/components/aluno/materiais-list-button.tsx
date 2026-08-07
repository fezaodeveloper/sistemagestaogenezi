"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { PdfViewerButton } from "@/components/aluno/pdf-viewer-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Material = { id: string; titulo: string };

// Só usado quando há 2+ PDFs — com 1 só, o PdfViewerButton já é usado
// direto na barra (abre o visualizador sem esse passo intermediário de
// lista).
export function MateriaisListButton({ materiais }: { materiais: Material[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FileText />
        Materiais ({materiais.length})
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Materiais da aula</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {materiais.map((material) => (
            <PdfViewerButton key={material.id} materialId={material.id} titulo={material.titulo} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
