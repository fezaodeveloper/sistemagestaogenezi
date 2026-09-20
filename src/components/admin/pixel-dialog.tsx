"use client";

// "use client": formulário com estado e envio por Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPixel } from "@/app/admin/configuracoes/apps/pixels/actions";
import { PIXEL_TIPOS, PIXEL_TIPO_DICAS, PIXEL_TIPO_LABELS, isPixelTipo, type PixelTipo } from "@/lib/pixels/tipos";
import { CursosChecklist, type CursoOpcao } from "@/components/admin/cursos-checklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type PixelItem = {
  id: string;
  nome: string;
  tipo: string;
  script: string;
  ativo: boolean;
  cursos_ids: string[];
};

export function PixelDialog({
  pixel,
  cursos,
  onClose,
}: {
  // null = novo pixel.
  pixel: PixelItem | null;
  cursos: CursoOpcao[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(pixel?.nome ?? "");
  const [tipo, setTipo] = useState<PixelTipo>(pixel && isPixelTipo(pixel.tipo) ? pixel.tipo : "meta_ads");
  const [script, setScript] = useState(pixel?.script ?? "");
  const [ativo, setAtivo] = useState(pixel?.ativo ?? true);
  const [cursosIds, setCursosIds] = useState<Set<string>>(() => new Set(pixel?.cursos_ids ?? []));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  function handleSalvar() {
    setErro(null);
    startSalvar(async () => {
      const resultado = await salvarPixel(pixel?.id ?? null, { nome, tipo, script, ativo, cursosIds: [...cursosIds] });
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{pixel ? "Editar pixel" : "Novo pixel"}</DialogTitle>
          <DialogDescription>
            O código roda no navegador de quem abre as páginas públicas (campanhas e agendamento).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="px-nome">Nome</Label>
            <Input id="px-nome" value={nome} maxLength={100} placeholder="Ex.: Meta - Loja principal" onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="px-tipo">Tipo</Label>
            <Select items={PIXEL_TIPO_LABELS} value={tipo} onValueChange={(valor) => valor && isPixelTipo(valor) && setTipo(valor)}>
              <SelectTrigger id="px-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIXEL_TIPOS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {PIXEL_TIPO_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="px-script">Script</Label>
            <Textarea
              id="px-script"
              rows={9}
              spellCheck={false}
              className="font-mono text-xs"
              value={script}
              placeholder="<script> ... </script>"
              onChange={(e) => setScript(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{PIXEL_TIPO_DICAS[tipo]}</p>
          </div>

          <CursosChecklist
            cursos={cursos}
            selecionados={cursosIds}
            onChange={setCursosIds}
            textoAjuda="Sem nenhum curso marcado, o pixel vale em todas as páginas públicas. Com cursos marcados, vale só nas campanhas desses cursos (a página de agendamento não tem curso, então não recebe pixels restritos)."
          />

          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Ativo</span>
              <span className="text-muted-foreground text-xs">Desligado, o código não é carregado em nenhuma página.</span>
            </span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>

          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
