"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { atualizarAgendamentoPagina, criarAgendamentoPagina } from "@/app/admin/comercial/agendamentos/actions";
import {
  CAMPO_EXTRA_TIPOS,
  DIA_SEMANA_LABELS,
  type AgendamentoPagina,
  type CampoExtraTipo,
  type HorarioDisponivel,
} from "@/lib/agendamentos/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DIAS_SEMANA_ORDEM = [0, 1, 2, 3, 4, 5, 6];
const DIA_SEMANA_ITEMS: Record<string, string> = Object.fromEntries(
  DIAS_SEMANA_ORDEM.map((dia) => [String(dia), DIA_SEMANA_LABELS[dia]]),
);
const CAMPO_EXTRA_TIPO_LABELS: Record<string, string> = { texto: "Texto", select: "Select" };

type CampoExtraEdicao = { nome: string; tipo: CampoExtraTipo; opcoesTexto: string };

export function AgendamentoPaginaDialog({
  pagina,
  trigger,
  onSalvo,
}: {
  pagina?: AgendamentoPagina;
  trigger: ReactElement;
  onSalvo?: (id: string) => void;
}) {
  const editando = !!pagina;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(pagina?.titulo ?? "");
  const [slug, setSlug] = useState(pagina?.slug ?? "");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(editando);
  const [corPrimaria, setCorPrimaria] = useState(pagina?.cor_primaria ?? "#06b6d4");
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>(pagina?.horarios_disponiveis ?? []);
  const [novoDia, setNovoDia] = useState("1");
  const [novoHorario, setNovoHorario] = useState("09:00");
  const [campos, setCampos] = useState<CampoExtraEdicao[]>(
    (pagina?.campos_extras ?? []).map((c) => ({ nome: c.nome, tipo: c.tipo, opcoesTexto: (c.opcoes ?? []).join(", ") })),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTitulo(pagina?.titulo ?? "");
      setSlug(pagina?.slug ?? "");
      setSlugEditadoManualmente(editando);
      setCorPrimaria(pagina?.cor_primaria ?? "#06b6d4");
      setHorarios(pagina?.horarios_disponiveis ?? []);
      setCampos(
        (pagina?.campos_extras ?? []).map((c) => ({
          nome: c.nome,
          tipo: c.tipo,
          opcoesTexto: (c.opcoes ?? []).join(", "),
        })),
      );
      setError(null);
    }
  }

  function handleTituloChange(valor: string) {
    setTitulo(valor);
    if (!slugEditadoManualmente) setSlug(slugify(valor));
  }

  function adicionarHorario() {
    const dia = Number(novoDia);
    const jaExiste = horarios.some((h) => h.dia_semana === dia && h.horario === novoHorario);
    if (jaExiste) return;
    setHorarios((prev) =>
      [...prev, { dia_semana: dia, horario: novoHorario }].sort((a, b) =>
        a.dia_semana === b.dia_semana ? a.horario.localeCompare(b.horario) : a.dia_semana - b.dia_semana,
      ),
    );
  }

  function removerHorario(index: number) {
    setHorarios((prev) => prev.filter((_, i) => i !== index));
  }

  function adicionarCampo() {
    setCampos((prev) => [...prev, { nome: "", tipo: "texto", opcoesTexto: "" }]);
  }

  function removerCampo(index: number) {
    setCampos((prev) => prev.filter((_, i) => i !== index));
  }

  function atualizarCampo(index: number, dados: Partial<CampoExtraEdicao>) {
    setCampos((prev) => prev.map((c, i) => (i === index ? { ...c, ...dados } : c)));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("cor_primaria", corPrimaria);
    formData.set("horarios_disponiveis", JSON.stringify(horarios));
    formData.set(
      "campos_extras",
      JSON.stringify(
        campos
          .filter((c) => c.nome.trim())
          .map((c) => ({
            nome: c.nome.trim(),
            tipo: c.tipo,
            opcoes:
              c.tipo === "select"
                ? c.opcoesTexto
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean)
                : undefined,
          })),
      ),
    );

    startTransition(async () => {
      const resultado = editando
        ? await atualizarAgendamentoPagina(pagina.id, formData)
        : await criarAgendamentoPagina(formData);

      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      router.refresh();
      if (!editando && resultado.id) onSalvo?.(resultado.id);
      else onSalvo?.(pagina!.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar página de agendamento" : "Nova página de agendamento"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              name="titulo"
              value={titulo}
              onChange={(event) => handleTituloChange(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="slug">Slug (URL pública)</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">/agendar/</span>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEditadoManualmente(true);
                  setSlug(slugify(event.target.value));
                }}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" rows={3} defaultValue={pagina?.descricao ?? ""} placeholder="Opcional" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cor_primaria">Cor primária</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corPrimaria}
                onChange={(event) => setCorPrimaria(event.target.value)}
                className="border-input h-8 w-14 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <span className="text-muted-foreground text-sm">{corPrimaria}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_inicio">Data início (opcional)</Label>
              <Input id="data_inicio" name="data_inicio" type="date" defaultValue={pagina?.data_inicio ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_fim">Data fim (opcional)</Label>
              <Input id="data_fim" name="data_fim" type="date" defaultValue={pagina?.data_fim ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vagas_por_horario">Vagas por horário</Label>
              <Input
                id="vagas_por_horario"
                name="vagas_por_horario"
                type="number"
                min="1"
                defaultValue={pagina?.vagas_por_horario ?? 1}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duracao_minutos">Duração (minutos)</Label>
              <Input
                id="duracao_minutos"
                name="duracao_minutos"
                type="number"
                min="1"
                defaultValue={pagina?.duracao_minutos ?? 30}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dias_antecedencia_minimo">Antecedência mín. (dias)</Label>
              <Input
                id="dias_antecedencia_minimo"
                name="dias_antecedencia_minimo"
                type="number"
                min="0"
                defaultValue={pagina?.dias_antecedencia_minimo ?? 1}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mensagem_confirmacao">Mensagem de confirmação</Label>
            <Textarea
              id="mensagem_confirmacao"
              name="mensagem_confirmacao"
              rows={2}
              defaultValue={pagina?.mensagem_confirmacao ?? ""}
              placeholder="Opcional — mostrada na tela de sucesso após o agendamento"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Horários disponíveis</Label>
            {horarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {horarios.map((h, index) => (
                  <span
                    key={`${h.dia_semana}-${h.horario}`}
                    className="bg-muted/50 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                  >
                    {DIA_SEMANA_LABELS[h.dia_semana]} {h.horario}
                    <button type="button" onClick={() => removerHorario(index)} aria-label="Remover horário">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Select items={DIA_SEMANA_ITEMS} value={novoDia} onValueChange={(v) => v && setNovoDia(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA_ORDEM.map((dia) => (
                    <SelectItem key={dia} value={String(dia)}>
                      {DIA_SEMANA_LABELS[dia]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={novoHorario}
                onChange={(event) => setNovoHorario(event.target.value)}
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={adicionarHorario}>
                <Plus />
                Adicionar horário
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Campos extras (opcional)</Label>
            {campos.map((campo, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <Input
                  value={campo.nome}
                  onChange={(event) => atualizarCampo(index, { nome: event.target.value })}
                  placeholder="Nome do campo"
                  className="max-w-40"
                />
                <Select
                  items={CAMPO_EXTRA_TIPO_LABELS}
                  value={campo.tipo}
                  onValueChange={(v) => v && atualizarCampo(index, { tipo: v as CampoExtraTipo })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPO_EXTRA_TIPOS.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo === "texto" ? "Texto" : "Select"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {campo.tipo === "select" && (
                  <Input
                    value={campo.opcoesTexto}
                    onChange={(event) => atualizarCampo(index, { opcoesTexto: event.target.value })}
                    placeholder="Opções separadas por vírgula"
                    className="min-w-48 flex-1"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removerCampo(index)}
                  className="text-muted-foreground hover:text-destructive ml-auto"
                  aria-label="Remover campo"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={adicionarCampo}>
              <Plus />
              Adicionar campo
            </Button>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
