"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, X } from "lucide-react";
import { atualizarCampanhaPagina, criarCampanhaPagina } from "@/app/admin/comercial/paginas-campanha/actions";
import { createClient } from "@/lib/supabase/client";
import {
  CAMPANHA_PAGINA_BUCKET,
  CAMPANHA_PAGINA_IMAGEM_MAXIMO_BYTES,
  CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS,
} from "@/lib/storage/campanha-paginas";
import {
  CAMPANHA_PAGINA_STATUSES,
  CAMPANHA_PAGINA_STATUS_LABELS,
  CAMPANHA_TEMAS,
  QUESTAO_TIPOS,
  QUESTAO_TIPO_LABELS,
  type CampanhaPagina,
  type CampanhaPaginaStatus,
  type CampanhaTema,
  type Etapa,
  type Questao,
  type QuestaoTipo,
} from "@/lib/campanha-paginas/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEMA_LABELS: Record<CampanhaTema, string> = { escuro: "Escuro", claro: "Claro" };

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function novaQuestao(): Questao {
  return { id: `q${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, tipo: "texto", pergunta: "", obrigatoria: true, opcoes: [] };
}

function proximaLetra(quantidade: number): string {
  return String.fromCharCode(65 + quantidade);
}

// Datas vêm de <input type="datetime-local"> (sem timezone) e são salvas
// como digitadas — o Postgres interpreta no timezone da sessão (UTC no
// Supabase). Simplificação aceita (REGRAS: preview/editor não precisam ser
// perfeitos) — o admin deve considerar que o horário salvo pode ficar ~3h
// à frente do horário de Brasília digitado.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function QuestaoEditor({
  questao,
  onChange,
  onRemover,
  onMoverCima,
  onMoverBaixo,
}: {
  questao: Questao;
  onChange: (dados: Partial<Questao>) => void;
  onRemover: () => void;
  onMoverCima?: () => void;
  onMoverBaixo?: () => void;
}) {
  const opcoes = questao.opcoes ?? [];

  function adicionarOpcao() {
    onChange({ opcoes: [...opcoes, { letra: proximaLetra(opcoes.length), texto: "" }] });
  }

  function atualizarOpcao(index: number, texto: string) {
    onChange({ opcoes: opcoes.map((o, i) => (i === index ? { ...o, texto } : o)) });
  }

  function removerOpcao(index: number) {
    onChange({ opcoes: opcoes.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={questao.pergunta}
          onChange={(event) => onChange({ pergunta: event.target.value })}
          placeholder="Texto da pergunta"
          className="flex-1"
        />
        <Select
          items={QUESTAO_TIPO_LABELS}
          value={questao.tipo}
          onValueChange={(v) => v && onChange({ tipo: v as QuestaoTipo })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTAO_TIPOS.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {QUESTAO_TIPO_LABELS[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={questao.obrigatoria} onCheckedChange={(v) => onChange({ obrigatoria: v })} />
          Obrigatória
        </label>
        <div className="ml-auto flex items-center gap-1">
          {onMoverCima && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onMoverCima} aria-label="Mover pergunta pra cima">
              ↑
            </Button>
          )}
          {onMoverBaixo && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onMoverBaixo} aria-label="Mover pergunta pra baixo">
              ↓
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={onRemover} aria-label="Remover pergunta">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {questao.tipo === "multipla_escolha" && (
        <div className="flex flex-col gap-1.5 pl-2">
          {opcoes.map((opcao, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-muted-foreground w-5 text-sm font-medium">{opcao.letra}</span>
              <Input
                value={opcao.texto}
                onChange={(event) => atualizarOpcao(index, event.target.value)}
                placeholder="Texto da opção"
                className="flex-1"
              />
              <button type="button" onClick={() => removerOpcao(index)} aria-label="Remover opção" className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={adicionarOpcao}>
            <Plus className="size-3.5" />
            Adicionar opção
          </Button>
        </div>
      )}
    </div>
  );
}

function EtapaEditor({
  etapa,
  onChange,
  onRemover,
  onMoverCima,
  onMoverBaixo,
}: {
  etapa: Etapa;
  onChange: (dados: Partial<Etapa>) => void;
  onRemover: () => void;
  onMoverCima?: () => void;
  onMoverBaixo?: () => void;
}) {
  function atualizarQuestao(index: number, dados: Partial<Questao>) {
    onChange({ questoes: etapa.questoes.map((q, i) => (i === index ? { ...q, ...dados } : q)) });
  }

  function removerQuestao(index: number) {
    onChange({ questoes: etapa.questoes.filter((_, i) => i !== index) });
  }

  function moverQuestao(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= etapa.questoes.length) return;
    const copia = [...etapa.questoes];
    [copia[index], copia[novoIndex]] = [copia[novoIndex], copia[index]];
    onChange({ questoes: copia });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input
            value={etapa.titulo}
            onChange={(event) => onChange({ titulo: event.target.value })}
            placeholder="Título da etapa"
            className="flex-1 font-medium"
          />
          <div className="flex items-center gap-1">
            {onMoverCima && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onMoverCima} aria-label="Mover etapa pra cima">
                ↑
              </Button>
            )}
            {onMoverBaixo && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onMoverBaixo} aria-label="Mover etapa pra baixo">
                ↓
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={onRemover} aria-label="Remover etapa">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
        <Textarea
          value={etapa.descricao ?? ""}
          onChange={(event) => onChange({ descricao: event.target.value })}
          placeholder="Descrição da etapa (opcional)"
          rows={2}
        />

        <div className="flex flex-col gap-2">
          {etapa.questoes.map((questao, index) => (
            <QuestaoEditor
              key={questao.id}
              questao={questao}
              onChange={(dados) => atualizarQuestao(index, dados)}
              onRemover={() => removerQuestao(index)}
              onMoverCima={index > 0 ? () => moverQuestao(index, -1) : undefined}
              onMoverBaixo={index < etapa.questoes.length - 1 ? () => moverQuestao(index, 1) : undefined}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => onChange({ questoes: [...etapa.questoes, novaQuestao()] })}
          >
            <Plus className="size-3.5" />
            Adicionar questão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampanhaEditor({
  pagina,
  cursos,
}: {
  pagina?: CampanhaPagina;
  cursos: { id: string; nome: string }[];
}) {
  const editando = !!pagina;
  const router = useRouter();

  const [titulo, setTitulo] = useState(pagina?.titulo ?? "");
  const [slug, setSlug] = useState(pagina?.slug ?? "");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(editando);
  const [subtitulo, setSubtitulo] = useState(pagina?.subtitulo ?? "");
  const [descricao, setDescricao] = useState(pagina?.descricao ?? "");
  const [cursoId, setCursoId] = useState(pagina?.curso_id ?? "");
  const [status, setStatus] = useState<CampanhaPaginaStatus>(pagina?.status ?? "ativa");
  const [dataInicio, setDataInicio] = useState(toDatetimeLocal(pagina?.data_inicio ?? null));
  const [dataFim, setDataFim] = useState(toDatetimeLocal(pagina?.data_fim ?? null));
  const [vagasLimite, setVagasLimite] = useState(pagina?.vagas_limite?.toString() ?? "");
  const [coletarEmail, setColetarEmail] = useState(pagina?.coletar_email ?? false);
  const [coletarCidade, setColetarCidade] = useState(pagina?.coletar_cidade ?? true);
  const [mostrarContador, setMostrarContador] = useState(pagina?.mostrar_contador ?? false);
  const [contadorDataFim, setContadorDataFim] = useState(toDatetimeLocal(pagina?.contador_data_fim ?? null));

  const [tema, setTema] = useState<CampanhaTema>(pagina?.tema ?? "escuro");
  const [corPrimaria, setCorPrimaria] = useState(pagina?.cor_primaria ?? "#06b6d4");
  const [corFundo, setCorFundo] = useState(pagina?.cor_fundo ?? "#0f172a");
  const [logoUrl, setLogoUrl] = useState(pagina?.logo_url ?? "");
  const [imagemTopoUrl, setImagemTopoUrl] = useState(pagina?.imagem_topo_url ?? "");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [enviandoImagemTopo, setEnviandoImagemTopo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imagemTopoInputRef = useRef<HTMLInputElement>(null);

  const [etapas, setEtapas] = useState<Etapa[]>(pagina?.etapas ?? []);

  const [mostrarLgpd, setMostrarLgpd] = useState(pagina?.mostrar_lgpd ?? true);
  const [textoLgpd, setTextoLgpd] = useState(pagina?.texto_lgpd ?? "");
  const [mostrarDeclaracao, setMostrarDeclaracao] = useState(pagina?.mostrar_declaracao ?? false);
  const [textoDeclaracao, setTextoDeclaracao] = useState(pagina?.texto_declaracao ?? "");

  const [tituloSucesso, setTituloSucesso] = useState(pagina?.titulo_sucesso ?? "Inscrição enviada!");
  const [mensagemSucesso, setMensagemSucesso] = useState(pagina?.mensagem_sucesso ?? "");
  const [notificarTelegram, setNotificarTelegram] = useState(pagina?.notificar_telegram ?? true);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cursoItems = Object.fromEntries([["", "Nenhum"], ...cursos.map((c) => [c.id, c.nome])]);

  function handleTituloChange(valor: string) {
    setTitulo(valor);
    if (!slugEditadoManualmente) setSlug(slugify(valor));
  }

  async function handleUploadImagem(
    event: React.ChangeEvent<HTMLInputElement>,
    setUrl: (url: string) => void,
    setEnviando: (v: boolean) => void,
  ) {
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

    setEnviando(true);
    try {
      const supabase = createClient();
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(CAMPANHA_PAGINA_BUCKET).upload(path, file);
      if (uploadError) {
        setError("Não foi possível enviar a imagem. Tente novamente.");
        return;
      }
      const { data: urlData } = supabase.storage.from(CAMPANHA_PAGINA_BUCKET).getPublicUrl(path);
      setUrl(urlData.publicUrl);
    } finally {
      setEnviando(false);
    }
  }

  function adicionarEtapa() {
    setEtapas((prev) => [...prev, { titulo: "Nova etapa", descricao: "", questoes: [] }]);
  }

  function atualizarEtapa(index: number, dados: Partial<Etapa>) {
    setEtapas((prev) => prev.map((e, i) => (i === index ? { ...e, ...dados } : e)));
  }

  function removerEtapa(index: number) {
    setEtapas((prev) => prev.filter((_, i) => i !== index));
  }

  function moverEtapa(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= etapas.length) return;
    setEtapas((prev) => {
      const copia = [...prev];
      [copia[index], copia[novoIndex]] = [copia[novoIndex], copia[index]];
      return copia;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    // O editor é organizado em abas (Tabs do Base UI) e cada TabsContent
    // desmonta de verdade (return null) quando não é a aba ativa —
    // keepMounted é false por padrão (ver node_modules/@base-ui/react/tabs/panel/TabsPanel.js).
    // Isso significa que TODO input nativo (name="...") que vive dentro de
    // uma aba que não seja a atual no momento do clique em "Salvar" está
    // fora do DOM e não é enviado pelo form. Por isso todo campo abaixo é
    // sincronizado manualmente a partir do estado do React, nunca confiando
    // no FormData nativo — mesmo os que "sempre pareciam funcionar" nos
    // testes (porque só falham quando o Salvar é clicado numa aba diferente
    // da que contém aquele campo).
    formData.set("titulo", titulo);
    formData.set("slug", slug);
    formData.set("subtitulo", subtitulo);
    formData.set("descricao", descricao);
    formData.set("cor_primaria", corPrimaria);
    formData.set("cor_fundo", corFundo);
    formData.set("logo_url", logoUrl);
    formData.set("imagem_topo_url", imagemTopoUrl);
    formData.set("tema", tema);
    formData.set("status", status);
    formData.set("data_inicio", dataInicio);
    formData.set("data_fim", dataFim);
    formData.set("vagas_limite", vagasLimite);
    formData.set("mostrar_contador", String(mostrarContador));
    formData.set("contador_data_fim", contadorDataFim);
    formData.set("coletar_email", String(coletarEmail));
    formData.set("coletar_cidade", String(coletarCidade));
    formData.set("etapas", JSON.stringify(etapas));
    formData.set("mostrar_lgpd", String(mostrarLgpd));
    formData.set("texto_lgpd", textoLgpd);
    formData.set("mostrar_declaracao", String(mostrarDeclaracao));
    formData.set("texto_declaracao", textoDeclaracao);
    formData.set("titulo_sucesso", tituloSucesso);
    formData.set("mensagem_sucesso", mensagemSucesso);
    formData.set("notificar_telegram", String(notificarTelegram));
    if (cursoId) formData.set("curso_id", cursoId);

    startTransition(async () => {
      const resultado = editando
        ? await atualizarCampanhaPagina(pagina.id, formData)
        : await criarCampanhaPagina(formData);

      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      if (!editando && resultado.id) {
        router.push(`/admin/comercial/paginas-campanha/${resultado.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-background sticky top-0 z-10 -mx-6 flex items-center justify-between gap-4 border-b px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold">{editando ? "Editar página de campanha" : "Nova página de campanha"}</h1>
          {slug && <p className="text-muted-foreground text-xs">/campanha/{slug}</p>}
        </div>
        <div className="flex items-center gap-2">
          {editando && (
            <Button type="button" variant="outline" size="sm" nativeButton={false} render={<a href={`/campanha/${slug}`} target="_blank" rel="noreferrer" />}>
              Visualizar página
            </Button>
          )}
          <Button type="submit" form="campanha-editor-form" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <form id="campanha-editor-form" action={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Tabs defaultValue="configuracoes">
              <TabsList className="flex-wrap">
                <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
                <TabsTrigger value="visual">Visual</TabsTrigger>
                <TabsTrigger value="etapas">Etapas</TabsTrigger>
                <TabsTrigger value="termos">Termos</TabsTrigger>
                <TabsTrigger value="sucesso">Sucesso</TabsTrigger>
              </TabsList>

              <TabsContent value="configuracoes">
                <Card>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="titulo">Título da página</Label>
                      <Input id="titulo" name="titulo" value={titulo} onChange={(e) => handleTituloChange(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="slug">Slug (URL pública)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">/campanha/</span>
                        <Input
                          id="slug"
                          name="slug"
                          value={slug}
                          onChange={(e) => {
                            setSlugEditadoManualmente(true);
                            setSlug(slugify(e.target.value));
                          }}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="subtitulo">Subtítulo</Label>
                      <Input id="subtitulo" name="subtitulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea id="descricao" name="descricao" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="curso_id">Curso vinculado (opcional)</Label>
                      <Select items={cursoItems} value={cursoId} onValueChange={(v) => setCursoId(v ?? "")}>
                        <SelectTrigger id="curso_id" className="w-full">
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
                      <p className="text-muted-foreground text-xs">
                        Sem curso vinculado, as respostas não geram lead automaticamente (só ficam salvas aqui).
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="status">Status</Label>
                      <Select items={CAMPANHA_PAGINA_STATUS_LABELS} value={status} onValueChange={(v) => v && setStatus(v as CampanhaPaginaStatus)}>
                        <SelectTrigger id="status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMPANHA_PAGINA_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {CAMPANHA_PAGINA_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="data_inicio">Data início</Label>
                        <Input id="data_inicio" name="data_inicio" type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="data_fim">Data fim</Label>
                        <Input id="data_fim" name="data_fim" type="datetime-local" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vagas_limite">Vagas limite (opcional)</Label>
                      <Input id="vagas_limite" name="vagas_limite" type="number" min="1" value={vagasLimite} onChange={(e) => setVagasLimite(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-normal">Coletar email</Label>
                      <Switch checked={coletarEmail} onCheckedChange={setColetarEmail} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-normal">Coletar cidade</Label>
                      <Switch checked={coletarCidade} onCheckedChange={setColetarCidade} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-normal">Mostrar contador regressivo</Label>
                      <Switch checked={mostrarContador} onCheckedChange={setMostrarContador} />
                    </div>
                    {mostrarContador && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="contador_data_fim">Contador termina em</Label>
                        <Input
                          id="contador_data_fim"
                          name="contador_data_fim"
                          type="datetime-local"
                          value={contadorDataFim}
                          onChange={(e) => setContadorDataFim(e.target.value)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="visual">
                <Card>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Tema</Label>
                      <div className="flex gap-3">
                        {CAMPANHA_TEMAS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTema(t)}
                            className={
                              "flex-1 rounded-md border-2 p-4 text-center text-sm transition-colors " +
                              (tema === t ? "border-primary" : "border-input hover:bg-muted")
                            }
                            style={t === "escuro" ? { backgroundColor: "#0f172a", color: "#fff" } : { backgroundColor: "#fff", color: "#0f172a" }}
                          >
                            {TEMA_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Cor primária</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={corPrimaria} onChange={(e) => setCorPrimaria(e.target.value)} className="border-input h-8 w-14 cursor-pointer rounded-md border bg-transparent p-0.5" />
                          <span className="text-muted-foreground text-sm">{corPrimaria}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Cor de fundo</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={corFundo} onChange={(e) => setCorFundo(e.target.value)} className="border-input h-8 w-14 cursor-pointer rounded-md border bg-transparent p-0.5" />
                          <span className="text-muted-foreground text-sm">{corFundo}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Logo</Label>
                      <input ref={logoInputRef} type="file" accept={CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS.join(",")} onChange={(e) => handleUploadImagem(e, setLogoUrl, setEnviandoLogo)} className="hidden" />
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
                          <img src={logoUrl} alt="Logo" className="h-14 w-28 rounded-md border object-contain bg-white p-1" />
                        ) : (
                          <div className="text-muted-foreground flex h-14 w-28 items-center justify-center rounded-md border-2 border-dashed text-xs">Sem logo</div>
                        )}
                        <Button type="button" variant="outline" size="sm" disabled={enviandoLogo} onClick={() => logoInputRef.current?.click()}>
                          <Upload className="size-3.5" />
                          {enviandoLogo ? "Enviando..." : logoUrl ? "Trocar" : "Enviar"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Imagem de topo</Label>
                      <input ref={imagemTopoInputRef} type="file" accept={CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS.join(",")} onChange={(e) => handleUploadImagem(e, setImagemTopoUrl, setEnviandoImagemTopo)} className="hidden" />
                      <div className="flex items-center gap-3">
                        {imagemTopoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
                          <img src={imagemTopoUrl} alt="Imagem de topo" className="h-14 w-28 rounded-md border object-cover" />
                        ) : (
                          <div className="text-muted-foreground flex h-14 w-28 items-center justify-center rounded-md border-2 border-dashed text-xs">Sem imagem</div>
                        )}
                        <Button type="button" variant="outline" size="sm" disabled={enviandoImagemTopo} onClick={() => imagemTopoInputRef.current?.click()}>
                          <Upload className="size-3.5" />
                          {enviandoImagemTopo ? "Enviando..." : imagemTopoUrl ? "Trocar" : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="etapas">
                <div className="flex flex-col gap-3">
                  {etapas.map((etapa, index) => (
                    <EtapaEditor
                      key={index}
                      etapa={etapa}
                      onChange={(dados) => atualizarEtapa(index, dados)}
                      onRemover={() => removerEtapa(index)}
                      onMoverCima={index > 0 ? () => moverEtapa(index, -1) : undefined}
                      onMoverBaixo={index < etapas.length - 1 ? () => moverEtapa(index, 1) : undefined}
                    />
                  ))}
                  <Button type="button" variant="outline" className="w-fit" onClick={adicionarEtapa}>
                    <Plus />
                    Adicionar etapa
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="termos">
                <Card>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-normal">Mostrar autorização LGPD</Label>
                      <Switch checked={mostrarLgpd} onCheckedChange={setMostrarLgpd} />
                    </div>
                    {mostrarLgpd && (
                      <Textarea
                        value={textoLgpd}
                        onChange={(e) => setTextoLgpd(e.target.value)}
                        name="texto_lgpd"
                        rows={4}
                        placeholder="Autorizo o tratamento dos meus dados pessoais conforme a LGPD..."
                      />
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-normal">Mostrar declaração de interesse</Label>
                      <Switch checked={mostrarDeclaracao} onCheckedChange={setMostrarDeclaracao} />
                    </div>
                    {mostrarDeclaracao && (
                      <Textarea
                        value={textoDeclaracao}
                        onChange={(e) => setTextoDeclaracao(e.target.value)}
                        name="texto_declaracao"
                        rows={4}
                        placeholder="Declaro ter interesse real na vaga/bolsa..."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sucesso">
                <Card>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="titulo_sucesso">Título da tela de sucesso</Label>
                      <Input id="titulo_sucesso" name="titulo_sucesso" value={tituloSucesso} onChange={(e) => setTituloSucesso(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mensagem_sucesso">Mensagem de sucesso</Label>
                      <Textarea id="mensagem_sucesso" name="mensagem_sucesso" rows={3} value={mensagemSucesso} onChange={(e) => setMensagemSucesso(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="font-normal">Notificar Telegram ao receber resposta</Label>
                      <Switch checked={notificarTelegram} onCheckedChange={setNotificarTelegram} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Preview (simplificado)</p>
            <div className="overflow-hidden rounded-lg border" style={{ backgroundColor: corFundo }}>
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- preview usa a imagem já enviada
                  <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
                )}
                <h2 className="text-xl font-bold" style={{ color: tema === "escuro" ? "#fff" : "#0f172a" }}>
                  {titulo || "Título da campanha"}
                </h2>
                {subtitulo && (
                  <p className="text-sm" style={{ color: tema === "escuro" ? "#cbd5e1" : "#475569" }}>
                    {subtitulo}
                  </p>
                )}

                <div className="mt-4 w-full rounded-md p-4 text-left" style={{ backgroundColor: tema === "escuro" ? "#1e293b" : "#f1f5f9" }}>
                  {etapas.length > 0 ? (
                    <>
                      <p className="text-xs font-medium" style={{ color: corPrimaria }}>
                        Etapa 1 de {etapas.length + 2}
                      </p>
                      <p className="mt-1 font-medium" style={{ color: tema === "escuro" ? "#fff" : "#0f172a" }}>
                        {etapas[0].titulo}
                      </p>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {etapas[0].questoes.slice(0, 3).map((q) => (
                          <p key={q.id} className="text-sm" style={{ color: tema === "escuro" ? "#cbd5e1" : "#475569" }}>
                            {q.pergunta || "(pergunta sem texto)"}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: tema === "escuro" ? "#cbd5e1" : "#475569" }}>
                      Nome, WhatsApp, idade{coletarEmail ? ", email" : ""}
                      {coletarCidade ? ", cidade" : ""}
                    </p>
                  )}
                </div>

                <button type="button" disabled className="mt-2 w-full rounded-md py-2 text-sm font-medium text-white" style={{ backgroundColor: corPrimaria }}>
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
