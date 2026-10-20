"use client";

// "use client": CRUD de templates com Dialog/AlertDialog e estado controlado. Formulário
// totalmente controlado (useState por campo, action chamada com objeto tipado, não FormData) —
// mesmo padrão de matricula-wizard.tsx, que evita depender de Checkbox nativo em FormData (Base
// UI Checkbox não é um <input> nativo participando da serialização do form).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarTemplate,
  alternarTemplateAtivo,
  criarTemplate,
  excluirTemplate,
  type PushTemplate,
} from "@/app/admin/notificacoes/actions";
import { PUSH_TEMPLATE_TIPOS, PUSH_TEMPLATE_TIPO_LABELS, type PushTemplateTipo } from "@/lib/push/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TEMPLATE_VAZIO = { nome: "", titulo: "", corpo: "", tipo: "aviso_geral" as PushTemplateTipo, ativo: true };

export function PushTemplatesSection({ templatesIniciais }: { templatesIniciais: PushTemplate[] }) {
  const router = useRouter();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(TEMPLATE_VAZIO);
  const [excluindo, setExcluindo] = useState<PushTemplate | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrirNovo() {
    setEditandoId(null);
    setForm(TEMPLATE_VAZIO);
    setErro(null);
    setDialogAberto(true);
  }

  function abrirEdicao(template: PushTemplate) {
    setEditandoId(template.id);
    setForm({ nome: template.nome, titulo: template.titulo, corpo: template.corpo, tipo: template.tipo, ativo: template.ativo });
    setErro(null);
    setDialogAberto(true);
  }

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = editandoId ? await atualizarTemplate(editandoId, form) : await criarTemplate(form);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setDialogAberto(false);
      router.refresh();
    });
  }

  function handleExcluir() {
    if (!excluindo) return;
    startTransition(async () => {
      const resultado = await excluirTemplate(excluindo.id);
      if ("error" in resultado) {
        setErro(resultado.error);
        setExcluindo(null);
        return;
      }
      setExcluindo(null);
      router.refresh();
    });
  }

  function handleToggleAtivo(template: PushTemplate, ativo: boolean) {
    startTransition(async () => {
      await alternarTemplateAtivo(template.id, ativo);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="flex items-center justify-between border-b p-4">
        <p className="text-sm font-medium">Modelos reutilizáveis de notificação.</p>
        <Button type="button" size="sm" onClick={abrirNovo}>
          <Plus />
          Novo Template
        </Button>
      </div>

      {templatesIniciais.length === 0 ? (
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Nenhum template cadastrado ainda.
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templatesIniciais.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.nome}</TableCell>
                <TableCell>
                  <Badge variant="outline">{PUSH_TEMPLATE_TIPO_LABELS[template.tipo]}</Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={template.ativo}
                    onCheckedChange={(valor) => handleToggleAtivo(template, valor)}
                    disabled={isPending}
                  />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(template)}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExcluindo(template)}>
                    <Trash2 />
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template_nome">Nome</Label>
              <Input
                id="template_nome"
                value={form.nome}
                onChange={(evento) => setForm({ ...form, nome: evento.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template_titulo">Título</Label>
              <Input
                id="template_titulo"
                maxLength={50}
                value={form.titulo}
                onChange={(evento) => setForm({ ...form, titulo: evento.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template_corpo">Corpo</Label>
              <Textarea
                id="template_corpo"
                rows={3}
                maxLength={150}
                value={form.corpo}
                onChange={(evento) => setForm({ ...form, corpo: evento.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template_tipo">Tipo</Label>
              <Select
                items={PUSH_TEMPLATE_TIPO_LABELS}
                value={form.tipo}
                onValueChange={(valor) => setForm({ ...form, tipo: valor as PushTemplateTipo })}
              >
                <SelectTrigger id="template_tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUSH_TEMPLATE_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {PUSH_TEMPLATE_TIPO_LABELS[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.ativo} onCheckedChange={(valor) => setForm({ ...form, ativo: valor === true })} id="template_ativo" />
              <Label htmlFor="template_ativo" className="font-normal">
                Ativo
              </Label>
            </div>
            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}
            <DialogFooter>
              <Button type="button" disabled={isPending} onClick={handleSalvar}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir &quot;{excluindo?.nome}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
