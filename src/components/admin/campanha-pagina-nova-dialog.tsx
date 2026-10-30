"use client";

// "use client": passos internos da modal (escolha → galeria → personalização) e chamada da
// Server Action de criação a partir de template.

import { useState, useTransition, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, LayoutTemplate, Plus } from "lucide-react";
import { criarCampanhaPaginaDeTemplate } from "@/app/admin/comercial/paginas-campanha/actions";
import { CAMPANHA_TEMPLATE_IDS, CAMPANHA_TEMPLATES, type CampanhaTemplateId } from "@/lib/campanha-paginas/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Passo = "escolha" | "galeria" | "customizar";

// Preview SIMPLIFICADO (div estilizada, não screenshot real) — barra colorida simulando o
// hero + linhas simulando subtítulo/texto, na cor de destaque do template.
function CampanhaTemplatePreview({ cor }: { cor: string }) {
  return (
    <div className="flex flex-col gap-1.5 overflow-hidden rounded-md border p-2" style={{ backgroundColor: "#0f172a" }}>
      <div className="h-6 rounded-sm" style={{ backgroundColor: cor }} />
      <div className="h-1.5 w-3/4 rounded-full bg-white/30" />
      <div className="h-1.5 w-1/2 rounded-full bg-white/20" />
      <div className="mt-1 h-4 w-1/3 rounded-sm" style={{ backgroundColor: cor }} />
    </div>
  );
}

export function CampanhaPaginaNovaDialog({
  trigger,
  cursos,
}: {
  trigger: ReactElement;
  cursos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [passo, setPasso] = useState<Passo>("escolha");
  const [templateId, setTemplateId] = useState<CampanhaTemplateId | null>(null);
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [dataLimite, setDataLimite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const template = templateId ? CAMPANHA_TEMPLATES[templateId] : null;
  const cursoItems = Object.fromEntries([["", "Nenhum"], ...cursos.map((c) => [c.id, c.nome])]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setPasso("escolha");
      setTemplateId(null);
      setTitulo("");
      setSubtitulo("");
      setCursoId("");
      setDataLimite("");
      setError(null);
    }
  }

  function escolherTemplate(id: CampanhaTemplateId) {
    const def = CAMPANHA_TEMPLATES[id];
    const gerado = def.gerar({ titulo: "", subtitulo: "" });
    setTemplateId(id);
    setTitulo(gerado.titulo);
    setSubtitulo(gerado.subtitulo);
    setPasso("customizar");
  }

  function criarPagina() {
    if (!templateId) return;
    setError(null);
    startTransition(async () => {
      const resultado = await criarCampanhaPaginaDeTemplate({ templateId, titulo, subtitulo, cursoId, dataLimite });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      if (resultado.id) router.push(`/admin/comercial/paginas-campanha/${resultado.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {passo === "escolha" && (
          <>
            <DialogHeader>
              <DialogTitle>Nova página de campanha</DialogTitle>
              <DialogDescription>Comece do zero ou use um dos templates prontos.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-2 p-4 text-left"
                nativeButton={false}
                render={<Link href="/admin/comercial/paginas-campanha/nova" />}
              >
                <FileText className="size-5" />
                <span className="font-medium">Em branco</span>
                <span className="text-muted-foreground text-xs font-normal">Monte a página do zero, do seu jeito.</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-2 p-4 text-left"
                onClick={() => setPasso("galeria")}
              >
                <LayoutTemplate className="size-5" />
                <span className="font-medium">Usar template</span>
                <span className="text-muted-foreground text-xs font-normal">Escolha um ponto de partida já pronto.</span>
              </Button>
            </div>
          </>
        )}

        {passo === "galeria" && (
          <>
            <DialogHeader>
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setPasso("escolha")}>
                <ArrowLeft className="size-3.5" />
                Voltar
              </Button>
              <DialogTitle>Escolha um template</DialogTitle>
              <DialogDescription>Depois de escolher, você ainda pode ajustar tudo no editor completo.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPANHA_TEMPLATE_IDS.map((id) => {
                const def = CAMPANHA_TEMPLATES[id];
                return (
                  <Card key={id} className="overflow-hidden">
                    <CardContent className="flex flex-col gap-3">
                      <CampanhaTemplatePreview cor={def.corDestaque} />
                      <div>
                        <p className="font-medium">{def.nome}</p>
                        <p className="text-muted-foreground text-xs">{def.descricao}</p>
                      </div>
                      <Button type="button" size="sm" className="w-full" onClick={() => escolherTemplate(id)}>
                        <Plus className="size-3.5" />
                        Usar este template
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {passo === "customizar" && template && (
          <>
            <DialogHeader>
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setPasso("galeria")}>
                <ArrowLeft className="size-3.5" />
                Voltar
              </Button>
              <DialogTitle>Personalizar &quot;{template.nome}&quot;</DialogTitle>
              <DialogDescription>Só o essencial agora — o resto você ajusta no editor completo.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cp-titulo">Título principal</Label>
                <Input id="cp-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cp-subtitulo">Subtítulo</Label>
                <Input id="cp-subtitulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
              </div>
              {template.pedeCurso && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cp-curso">Curso vinculado (opcional)</Label>
                  <Select items={cursoItems} value={cursoId} onValueChange={(v) => setCursoId(v ?? "")}>
                    <SelectTrigger id="cp-curso" className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {cursos.map((curso) => (
                        <SelectItem key={curso.id} value={curso.id}>
                          {curso.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {template.pedeDataLimite && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cp-data-limite">Data limite da oferta (opcional)</Label>
                  <Input id="cp-data-limite" type="datetime-local" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
                  <p className="text-muted-foreground text-xs">Ativa o contador regressivo até essa data.</p>
                </div>
              )}
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <Button type="button" disabled={!titulo.trim() || isPending} onClick={criarPagina}>
                {isPending ? "Criando..." : "Criar página"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
