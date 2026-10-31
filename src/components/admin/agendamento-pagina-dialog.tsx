"use client";

import { useRef, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CAMPANHA_PAGINA_BUCKET,
  CAMPANHA_PAGINA_IMAGEM_MAXIMO_BYTES,
  CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS,
} from "@/lib/storage/campanha-paginas";
import {
  atualizarAgendamentoPagina,
  criarAgendamentoPagina,
  type CampanhaPaginaOpcao,
} from "@/app/admin/comercial/agendamentos/actions";
import {
  ALINHAMENTOS_AGENDAMENTO,
  ARREDONDAMENTOS_BOTAO_AGENDAMENTO,
  CAMPO_EXTRA_TIPOS,
  CONFIG_VISUAL_PADRAO,
  DIA_SEMANA_LABELS,
  FONTES_AGENDAMENTO,
  feriadosNacionaisParaPeriodo,
  gerarSlotsDoDia,
  resolverConfigVisual,
  TAMANHOS_SUBTITULO_AGENDAMENTO,
  TAMANHOS_TITULO_AGENDAMENTO,
  TAMANHO_SUBTITULO_CSS,
  TAMANHO_TITULO_CSS,
  ARREDONDAMENTO_BOTAO_CSS,
  type AgendamentoPagina,
  type AlinhamentoAgendamento,
  type ArredondamentoBotaoAgendamento,
  type CampoExtraTipo,
  type ConfigVisualAgendamento,
  type FonteAgendamento,
  type HorarioDisponivel,
  type ResponsavelOpcao,
  type TamanhoSubtituloAgendamento,
  type TamanhoTituloAgendamento,
} from "@/lib/agendamentos/schema";
import { FONTE_AGENDAMENTO_CSS } from "@/lib/agendamentos/fontes";
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

const FONTE_ITEMS: Record<string, string> = Object.fromEntries(FONTES_AGENDAMENTO.map((f) => [f, f]));
const TITULO_TAMANHO_ITEMS: Record<string, string> = Object.fromEntries(
  TAMANHOS_TITULO_AGENDAMENTO.map((t) => [t, t.toUpperCase()]),
);
const SUBTITULO_TAMANHO_ITEMS: Record<string, string> = Object.fromEntries(
  TAMANHOS_SUBTITULO_AGENDAMENTO.map((t) => [t, t.toUpperCase()]),
);
const ALINHAMENTO_LABELS: Record<AlinhamentoAgendamento, string> = { left: "Esquerda", center: "Centro", right: "Direita" };
const ALINHAMENTO_ITEMS: Record<string, string> = Object.fromEntries(ALINHAMENTOS_AGENDAMENTO.map((a) => [a, ALINHAMENTO_LABELS[a]]));
const ARREDONDAMENTO_LABELS: Record<ArredondamentoBotaoAgendamento, string> = {
  none: "Nenhum",
  sm: "Pequeno",
  md: "Médio",
  lg: "Grande",
  full: "Total (pílula)",
};
const ARREDONDAMENTO_ITEMS: Record<string, string> = Object.fromEntries(
  ARREDONDAMENTOS_BOTAO_AGENDAMENTO.map((a) => [a, ARREDONDAMENTO_LABELS[a]]),
);

type CampoExtraEdicao = { nome: string; tipo: CampoExtraTipo; opcoesTexto: string };

export function AgendamentoPaginaDialog({
  pagina,
  responsaveis,
  campanhas,
  escolaLogoUrl,
  trigger,
  onSalvo,
}: {
  pagina?: AgendamentoPagina;
  responsaveis: ResponsavelOpcao[];
  campanhas: CampanhaPaginaOpcao[];
  escolaLogoUrl: string | null;
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
  // TAREFA logo — PARTE 2: logo específica da página (prioridade sobre a logo global da escola
  // na página pública — ver resolução em src/app/agendar/[slug]/page.tsx).
  const [logoUrl, setLogoUrl] = useState(pagina?.logo_url ?? "");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>(pagina?.horarios_disponiveis ?? []);
  const [novoDia, setNovoDia] = useState("1");
  // TAREFA — PARTE 2: janela "Das [hora_inicio] às [hora_fim]" por dia, substitui o antigo
  // "adicionar um horário por vez". gerarSlotsDoDia (preview abaixo) mostra os horários que essa
  // janela vai gerar de verdade, com a duração/intervalo atuais da página.
  const [novaHoraInicio, setNovaHoraInicio] = useState("08:00");
  const [novaHoraFim, setNovaHoraFim] = useState("12:00");
  const [campos, setCampos] = useState<CampoExtraEdicao[]>(
    (pagina?.campos_extras ?? []).map((c) => ({ nome: c.nome, tipo: c.tipo, opcoesTexto: (c.opcoes ?? []).join(", ") })),
  );
  const [responsavelId, setResponsavelId] = useState(pagina?.responsavel_id ?? "");
  // Controlados (diferente da maioria dos campos simples deste form) — "Adicionar feriados
  // nacionais" (PARTE 1) precisa ler o período digitado AGORA, mesmo antes de salvar.
  const [dataInicio, setDataInicio] = useState(pagina?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(pagina?.data_fim ?? "");
  // Controlados (PARTE 2) — o preview de slots gerados precisa ler duração/intervalo ao vivo.
  const [duracaoMinutos, setDuracaoMinutos] = useState(String(pagina?.duracao_minutos ?? 30));
  const [intervaloMinutos, setIntervaloMinutos] = useState(String(pagina?.intervalo_entre_horarios ?? 0));
  const [datasBloqueadas, setDatasBloqueadas] = useState<string[]>(pagina?.datas_bloqueadas ?? []);
  const [feriadosBloqueados, setFeriadosBloqueados] = useState<string[]>(pagina?.feriados_bloqueados ?? []);
  const [novaDataBloqueada, setNovaDataBloqueada] = useState("");
  // TAREFA — PARTE 3: campanha_paginas associada (opcional).
  const [campanhaId, setCampanhaId] = useState(pagina?.campanha_id ?? "");
  // TAREFA — PARTE 4: aparência do formulário público, com preview ao vivo.
  const [configVisual, setConfigVisual] = useState<Required<ConfigVisualAgendamento>>(() =>
    resolverConfigVisual(pagina?.config_visual),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function atualizarConfigVisual(dados: Partial<ConfigVisualAgendamento>) {
    setConfigVisual((prev) => ({ ...prev, ...dados }));
  }

  // TAREFA logo — PARTE 2: reaproveita o bucket "campanha-paginas" (já existe, já é público, já
  // tem policies de admin — ver src/lib/storage/campanha-paginas.ts) em vez de criar um bucket
  // novo só pra isso; mesmo padrão de upload de campanha-editor.tsx.
  async function handleUploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setError(null);
    if (!(CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS as readonly string[]).includes(file.type)) {
      setError("Formato não aceito. Use JPG, PNG, WebP ou SVG.");
      return;
    }
    if (file.size > CAMPANHA_PAGINA_IMAGEM_MAXIMO_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 5MB.");
      return;
    }

    setEnviandoLogo(true);
    try {
      const supabase = createClient();
      const nomeSeguro = file.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `agendamentos/${Date.now()}-${nomeSeguro}`;
      const { error: uploadError } = await supabase.storage.from(CAMPANHA_PAGINA_BUCKET).upload(path, file);
      if (uploadError) {
        setError("Não foi possível enviar a imagem. Tente novamente.");
        return;
      }
      const { data: urlData } = supabase.storage.from(CAMPANHA_PAGINA_BUCKET).getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
    } finally {
      setEnviandoLogo(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTitulo(pagina?.titulo ?? "");
      setSlug(pagina?.slug ?? "");
      setSlugEditadoManualmente(editando);
      setCorPrimaria(pagina?.cor_primaria ?? "#06b6d4");
      setLogoUrl(pagina?.logo_url ?? "");
      setHorarios(pagina?.horarios_disponiveis ?? []);
      setCampos(
        (pagina?.campos_extras ?? []).map((c) => ({
          nome: c.nome,
          tipo: c.tipo,
          opcoesTexto: (c.opcoes ?? []).join(", "),
        })),
      );
      setResponsavelId(pagina?.responsavel_id ?? "");
      setDataInicio(pagina?.data_inicio ?? "");
      setDataFim(pagina?.data_fim ?? "");
      setDuracaoMinutos(String(pagina?.duracao_minutos ?? 30));
      setIntervaloMinutos(String(pagina?.intervalo_entre_horarios ?? 0));
      setDatasBloqueadas(pagina?.datas_bloqueadas ?? []);
      setFeriadosBloqueados(pagina?.feriados_bloqueados ?? []);
      setNovaDataBloqueada("");
      setCampanhaId(pagina?.campanha_id ?? "");
      setConfigVisual(resolverConfigVisual(pagina?.config_visual));
      setError(null);
    }
  }

  function adicionarDataBloqueada() {
    if (!novaDataBloqueada || datasBloqueadas.includes(novaDataBloqueada)) return;
    setDatasBloqueadas((prev) => [...prev, novaDataBloqueada].sort());
    setNovaDataBloqueada("");
  }

  function removerDataBloqueada(data: string) {
    setDatasBloqueadas((prev) => prev.filter((d) => d !== data));
  }

  function removerFeriado(data: string) {
    setFeriadosBloqueados((prev) => prev.filter((d) => d !== data));
  }

  // TAREFA — PARTE 1: só os feriados dentro do período configurado (data_inicio/data_fim); sem
  // período, ano atual + próximo (nunca anos passados) — ver feriadosNacionaisParaPeriodo.
  function adicionarFeriadosNacionais() {
    const feriadosDoPeriodo = feriadosNacionaisParaPeriodo(dataInicio || null, dataFim || null);
    setFeriadosBloqueados((prev) => [...new Set([...prev, ...feriadosDoPeriodo])].sort());
  }

  function handleTituloChange(valor: string) {
    setTitulo(valor);
    if (!slugEditadoManualmente) setSlug(slugify(valor));
  }

  function adicionarJanela() {
    const dia = Number(novoDia);
    if (novaHoraFim <= novaHoraInicio) return;
    setHorarios((prev) => [...prev, { dia_semana: dia, hora_inicio: novaHoraInicio, hora_fim: novaHoraFim }]);
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
    formData.set("logo_url", logoUrl);
    formData.set("horarios_disponiveis", JSON.stringify(horarios));
    formData.set("responsavel_id", responsavelId);
    formData.set("datas_bloqueadas", JSON.stringify(datasBloqueadas));
    formData.set("feriados_bloqueados", JSON.stringify(feriadosBloqueados));
    formData.set("campanha_id", campanhaId);
    formData.set("config_visual", JSON.stringify(configVisual));
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

          <div className="flex flex-col gap-2">
            <Label>Logo da página (opcional)</Label>
            <input
              ref={logoInputRef}
              type="file"
              accept={CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS.join(",")}
              onChange={handleUploadLogo}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
                <img src={logoUrl} alt="Logo" className="h-14 w-28 rounded-md border bg-white object-contain p-1" />
              ) : (
                <div className="text-muted-foreground flex h-14 w-28 items-center justify-center rounded-md border-2 border-dashed text-xs">
                  Sem logo
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={enviandoLogo} onClick={() => logoInputRef.current?.click()}>
                  <Upload className="size-3.5" />
                  {enviandoLogo ? "Enviando..." : logoUrl ? "Trocar" : "Carregar imagem"}
                </Button>
                {escolaLogoUrl && logoUrl !== escolaLogoUrl && (
                  <Button type="button" variant="outline" size="sm" disabled={enviandoLogo} onClick={() => setLogoUrl(escolaLogoUrl)}>
                    Usar logo da escola
                  </Button>
                )}
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" disabled={enviandoLogo} onClick={() => setLogoUrl("")}>
                    <Trash2 className="size-3.5" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Sem logo própria, a página pública usa a logo da escola. JPG, PNG, WebP ou SVG · máx. 5MB.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <Label className="text-muted-foreground text-xs uppercase">Atendimento</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="local_atendimento">Local de atendimento</Label>
                <Input
                  id="local_atendimento"
                  name="local_atendimento"
                  defaultValue={pagina?.local_atendimento ?? ""}
                  placeholder="Ex.: Sede Gênezi — Rua X, 123"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="responsavel_id">Responsável</Label>
                <Select
                  items={Object.fromEntries(responsaveis.map((r) => [r.id, r.full_name ?? "—"]))}
                  value={responsavelId}
                  onValueChange={(v) => setResponsavelId(v ?? "")}
                >
                  <SelectTrigger id="responsavel_id" className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {responsaveis.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.full_name ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campanha_id">Campanha associada (opcional)</Label>
              <Select
                items={Object.fromEntries(campanhas.map((c) => [c.id, c.titulo]))}
                value={campanhaId}
                onValueChange={(v) => setCampanhaId(v ?? "")}
              >
                <SelectTrigger id="campanha_id" className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {campanhas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <Label className="text-muted-foreground text-xs uppercase">Disponibilidade</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="data_inicio">Data início (opcional)</Label>
                <Input id="data_inicio" name="data_inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="data_fim">Data fim (opcional)</Label>
                <Input id="data_fim" name="data_fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
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
                  value={duracaoMinutos}
                  onChange={(e) => setDuracaoMinutos(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="intervalo_entre_horarios">Intervalo entre horários (min)</Label>
                <Input
                  id="intervalo_entre_horarios"
                  name="intervalo_entre_horarios"
                  type="number"
                  min="0"
                  value={intervaloMinutos}
                  onChange={(e) => setIntervaloMinutos(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="antecedencia_maxima_dias">Antecedência máx. (dias à frente)</Label>
                <Input
                  id="antecedencia_maxima_dias"
                  name="antecedencia_maxima_dias"
                  type="number"
                  min="1"
                  defaultValue={pagina?.antecedencia_maxima_dias ?? 30}
                  required
                />
              </div>
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
                {horarios.map((h, index) => {
                  const slots = gerarSlotsDoDia(h, Number(duracaoMinutos) || 30, Number(intervaloMinutos) || 0);
                  return (
                    <span
                      key={`${h.dia_semana}-${h.horario ?? `${h.hora_inicio}-${h.hora_fim}`}`}
                      className="bg-muted/50 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                      title={h.horario ? undefined : `Slots: ${slots.join(", ") || "nenhum (janela muito curta pra duração atual)"}`}
                    >
                      {DIA_SEMANA_LABELS[h.dia_semana]} {h.horario ? h.horario : `${h.hora_inicio}–${h.hora_fim} (${slots.length} horário${slots.length === 1 ? "" : "s"})`}
                      <button type="button" onClick={() => removerHorario(index)} aria-label="Remover horário">
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
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
              <div className="flex items-center gap-1.5 text-sm">
                Das
                <Input type="time" value={novaHoraInicio} onChange={(event) => setNovaHoraInicio(event.target.value)} className="w-28" />
                às
                <Input type="time" value={novaHoraFim} onChange={(event) => setNovaHoraFim(event.target.value)} className="w-28" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={adicionarJanela} disabled={novaHoraFim <= novaHoraInicio}>
                <Plus />
                Adicionar
              </Button>
            </div>
            {novaHoraFim > novaHoraInicio && (
              <p className="text-muted-foreground text-xs">
                → Slots: {gerarSlotsDoDia({ dia_semana: Number(novoDia), hora_inicio: novaHoraInicio, hora_fim: novaHoraFim }, Number(duracaoMinutos) || 30, Number(intervaloMinutos) || 0).join(", ") || "nenhum (janela muito curta pra duração atual)"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Datas bloqueadas</Label>
            {(datasBloqueadas.length > 0 || feriadosBloqueados.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {datasBloqueadas.map((d) => (
                  <span key={d} className="bg-muted/50 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                    {d.split("-").reverse().join("/")}
                    <button type="button" onClick={() => removerDataBloqueada(d)} aria-label="Remover data bloqueada">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {feriadosBloqueados.map((d) => (
                  <span key={d} className="bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                    🎉 {d.split("-").reverse().join("/")}
                    <button type="button" onClick={() => removerFeriado(d)} aria-label="Remover feriado">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={novaDataBloqueada} onChange={(event) => setNovaDataBloqueada(event.target.value)} className="w-40" />
              <Button type="button" variant="outline" size="sm" onClick={adicionarDataBloqueada} disabled={!novaDataBloqueada}>
                <Plus />
                Adicionar data
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={adicionarFeriadosNacionais}>
                🎉 Adicionar feriados nacionais {dataInicio || dataFim ? "do período" : `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`}
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

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <Label className="text-muted-foreground text-xs uppercase">Aparência</Label>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  ["cor_fundo", "Fundo"],
                  ["cor_primaria", "Primária"],
                  ["cor_texto", "Texto"],
                  ["cor_texto_secundario", "Texto secundário"],
                ] as const
              ).map(([campo, label]) => (
                <div key={campo} className="flex flex-col gap-2">
                  <Label htmlFor={campo}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={campo}
                      type="color"
                      value={configVisual[campo]}
                      onChange={(event) => atualizarConfigVisual({ [campo]: event.target.value })}
                      className="border-input h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                    />
                    <span className="text-muted-foreground text-xs">{configVisual[campo]}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fonte">Fonte</Label>
                <Select
                  items={FONTE_ITEMS}
                  value={configVisual.fonte}
                  onValueChange={(v) => v && atualizarConfigVisual({ fonte: v as FonteAgendamento })}
                >
                  <SelectTrigger id="fonte" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTES_AGENDAMENTO.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="titulo_tamanho">Tamanho do título</Label>
                <Select
                  items={TITULO_TAMANHO_ITEMS}
                  value={configVisual.titulo_tamanho}
                  onValueChange={(v) => v && atualizarConfigVisual({ titulo_tamanho: v as TamanhoTituloAgendamento })}
                >
                  <SelectTrigger id="titulo_tamanho" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAMANHOS_TITULO_AGENDAMENTO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="titulo_alinhamento">Alinhamento do título</Label>
                <Select
                  items={ALINHAMENTO_ITEMS}
                  value={configVisual.titulo_alinhamento}
                  onValueChange={(v) => v && atualizarConfigVisual({ titulo_alinhamento: v as AlinhamentoAgendamento })}
                >
                  <SelectTrigger id="titulo_alinhamento" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALINHAMENTOS_AGENDAMENTO.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ALINHAMENTO_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subtitulo_tamanho">Tamanho do subtítulo</Label>
                <Select
                  items={SUBTITULO_TAMANHO_ITEMS}
                  value={configVisual.subtitulo_tamanho}
                  onValueChange={(v) => v && atualizarConfigVisual({ subtitulo_tamanho: v as TamanhoSubtituloAgendamento })}
                >
                  <SelectTrigger id="subtitulo_tamanho" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAMANHOS_SUBTITULO_AGENDAMENTO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subtitulo_alinhamento">Alinhamento do subtítulo</Label>
                <Select
                  items={ALINHAMENTO_ITEMS}
                  value={configVisual.subtitulo_alinhamento}
                  onValueChange={(v) => v && atualizarConfigVisual({ subtitulo_alinhamento: v as AlinhamentoAgendamento })}
                >
                  <SelectTrigger id="subtitulo_alinhamento" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALINHAMENTOS_AGENDAMENTO.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ALINHAMENTO_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
                <Label htmlFor="botao_texto">Texto do botão</Label>
                <Input
                  id="botao_texto"
                  value={configVisual.botao_texto}
                  onChange={(event) => atualizarConfigVisual({ botao_texto: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="botao_cor">Cor do botão</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="botao_cor"
                    type="color"
                    value={configVisual.botao_cor}
                    onChange={(event) => atualizarConfigVisual({ botao_cor: event.target.value })}
                    className="border-input h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                  />
                  <span className="text-muted-foreground text-xs">{configVisual.botao_cor}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="botao_cor_texto">Cor do texto do botão</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="botao_cor_texto"
                    type="color"
                    value={configVisual.botao_cor_texto}
                    onChange={(event) => atualizarConfigVisual({ botao_cor_texto: event.target.value })}
                    className="border-input h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                  />
                  <span className="text-muted-foreground text-xs">{configVisual.botao_cor_texto}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="botao_arredondamento">Arredondamento</Label>
                <Select
                  items={ARREDONDAMENTO_ITEMS}
                  value={configVisual.botao_arredondamento}
                  onValueChange={(v) => v && atualizarConfigVisual({ botao_arredondamento: v as ArredondamentoBotaoAgendamento })}
                >
                  <SelectTrigger id="botao_arredondamento" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARREDONDAMENTOS_BOTAO_AGENDAMENTO.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ARREDONDAMENTO_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview ao vivo — mesmo espírito do preview em tempo real de campanha-editor.tsx,
                simplificado (sem o calendário/formulário completo da página pública). */}
            <div
              className="flex flex-col items-center gap-3 rounded-md border p-6 text-center"
              style={{ backgroundColor: configVisual.cor_fundo, fontFamily: FONTE_AGENDAMENTO_CSS[configVisual.fonte] }}
            >
              <p
                style={{
                  color: configVisual.cor_texto,
                  fontSize: TAMANHO_TITULO_CSS[configVisual.titulo_tamanho],
                  textAlign: configVisual.titulo_alinhamento,
                  fontWeight: 600,
                  width: "100%",
                }}
              >
                {titulo || "Título da página"}
              </p>
              <p
                style={{
                  color: configVisual.cor_texto_secundario,
                  fontSize: TAMANHO_SUBTITULO_CSS[configVisual.subtitulo_tamanho],
                  textAlign: configVisual.subtitulo_alinhamento,
                  width: "100%",
                }}
              >
                Pré-visualização do subtítulo/descrição da página.
              </p>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium"
                style={{
                  backgroundColor: configVisual.botao_cor,
                  color: configVisual.botao_cor_texto,
                  borderRadius: ARREDONDAMENTO_BOTAO_CSS[configVisual.botao_arredondamento],
                }}
              >
                {configVisual.botao_texto || CONFIG_VISUAL_PADRAO.botao_texto}
              </button>
            </div>
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
