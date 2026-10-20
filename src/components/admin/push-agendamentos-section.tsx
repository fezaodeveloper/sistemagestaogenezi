"use client";

// "use client": mesmo padrão controlado de push-templates-section.tsx. Escolher um template no
// Select preenche título/corpo (o admin ainda pode editar antes de salvar) — push_agendamentos
// guarda título/corpo próprios (congelados no momento da criação), template_id é só referência.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  cancelarAgendamento,
  criarAgendamento,
  type PushAgendamento,
  type PushTemplate,
} from "@/app/admin/notificacoes/actions";
import {
  PUSH_AGENDAMENTO_DESTINATARIOS,
  PUSH_AGENDAMENTO_DESTINATARIO_LABELS,
  type PushAgendamentoDestinatario,
} from "@/lib/push/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const SEM_TEMPLATE = "nenhum";

const FORM_VAZIO = {
  templateId: SEM_TEMPLATE,
  titulo: "",
  corpo: "",
  destinatarios: "todos" as PushAgendamentoDestinatario,
  turmaId: "",
  agendadoPara: "",
};

function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function PushAgendamentosSection({
  agendamentosIniciais,
  templates,
  turmas,
}: {
  agendamentosIniciais: PushAgendamento[];
  templates: PushTemplate[];
  turmas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [cancelando, setCancelando] = useState<PushAgendamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const templatesAtivos = templates.filter((t) => t.ativo);
  const templateItems: Record<string, string> = { [SEM_TEMPLATE]: "Nenhum (escrever manualmente)" };
  for (const template of templatesAtivos) templateItems[template.id] = template.nome;

  const turmaItems: Record<string, string> = Object.fromEntries(turmas.map((t) => [t.id, t.nome]));

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setErro(null);
    setDialogAberto(true);
  }

  function selecionarTemplate(templateId: string) {
    const template = templatesAtivos.find((t) => t.id === templateId);
    setForm({
      ...form,
      templateId,
      titulo: template ? template.titulo : form.titulo,
      corpo: template ? template.corpo : form.corpo,
    });
  }

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarAgendamento({
        templateId: form.templateId === SEM_TEMPLATE ? null : form.templateId,
        titulo: form.titulo,
        corpo: form.corpo,
        destinatarios: form.destinatarios,
        turmaId: form.destinatarios === "turma" ? form.turmaId || null : null,
        agendadoPara: form.agendadoPara,
      });
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setDialogAberto(false);
      router.refresh();
    });
  }

  function handleCancelar() {
    if (!cancelando) return;
    startTransition(async () => {
      const resultado = await cancelarAgendamento(cancelando.id);
      if ("error" in resultado) {
        setErro(resultado.error);
        setCancelando(null);
        return;
      }
      setCancelando(null);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="flex items-center justify-between border-b p-4">
        <p className="text-sm font-medium">Notificações programadas pra uma data/hora futura.</p>
        <Button type="button" size="sm" onClick={abrirNovo}>
          <Plus />
          Novo Agendamento
        </Button>
      </div>

      {agendamentosIniciais.length === 0 ? (
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Nenhum agendamento criado ainda.
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Agendado para</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agendamentosIniciais.map((agendamento) => (
              <TableRow key={agendamento.id}>
                <TableCell className="font-medium">{agendamento.titulo}</TableCell>
                <TableCell>
                  {PUSH_AGENDAMENTO_DESTINATARIO_LABELS[agendamento.destinatarios]}
                  {agendamento.destinatarios === "turma" && agendamento.turma_nome ? ` — ${agendamento.turma_nome}` : ""}
                </TableCell>
                <TableCell>{formatDataHora(agendamento.agendado_para)}</TableCell>
                <TableCell>
                  {agendamento.enviado_em ? (
                    <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                      Enviado{typeof agendamento.total_enviado === "number" ? ` (${agendamento.total_enviado})` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  {!agendamento.enviado_em && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCancelando(agendamento)}>
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="agendamento_template">Usar template</Label>
              <Select items={templateItems} value={form.templateId} onValueChange={(valor) => selecionarTemplate(valor as string)}>
                <SelectTrigger id="agendamento_template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(templateItems).map((id) => (
                    <SelectItem key={id} value={id}>
                      {templateItems[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agendamento_titulo">Título</Label>
              <Input
                id="agendamento_titulo"
                maxLength={50}
                value={form.titulo}
                onChange={(evento) => setForm({ ...form, titulo: evento.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agendamento_corpo">Corpo</Label>
              <Textarea
                id="agendamento_corpo"
                rows={3}
                maxLength={150}
                value={form.corpo}
                onChange={(evento) => setForm({ ...form, corpo: evento.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agendamento_destinatarios">Destinatários</Label>
              <Select
                items={PUSH_AGENDAMENTO_DESTINATARIO_LABELS}
                value={form.destinatarios}
                onValueChange={(valor) => setForm({ ...form, destinatarios: valor as PushAgendamentoDestinatario })}
              >
                <SelectTrigger id="agendamento_destinatarios" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUSH_AGENDAMENTO_DESTINATARIOS.map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {PUSH_AGENDAMENTO_DESTINATARIO_LABELS[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.destinatarios === "turma" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="agendamento_turma">Turma</Label>
                {turmas.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma turma ativa encontrada.</p>
                ) : (
                  <Select items={turmaItems} value={form.turmaId || undefined} onValueChange={(valor) => setForm({ ...form, turmaId: valor as string })}>
                    <SelectTrigger id="agendamento_turma" className="w-full">
                      <SelectValue placeholder="Selecione a turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {turmas.map((turma) => (
                        <SelectItem key={turma.id} value={turma.id}>
                          {turma.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="agendamento_data">Data e hora do envio</Label>
              <Input
                id="agendamento_data"
                type="datetime-local"
                value={form.agendadoPara}
                onChange={(evento) => setForm({ ...form, agendadoPara: evento.target.value })}
                required
              />
            </div>
            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}
            <DialogFooter>
              <Button type="button" disabled={isPending} onClick={handleSalvar}>
                {isPending ? "Agendando..." : "Agendar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelando !== null} onOpenChange={(aberto) => !aberto && setCancelando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar o envio de &quot;{cancelando?.titulo}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleCancelar}>
              {isPending ? "Cancelando..." : "Cancelar agendamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
