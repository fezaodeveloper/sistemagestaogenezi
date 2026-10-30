"use client";

// "use client": editor com preview ao vivo, estimativa de destinatários e Server Actions.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Code, Mail, Save, Send, Users } from "lucide-react";
import {
  agendarCampanha,
  contarDestinatarios,
  desagendarCampanha,
  enviarCampanhaAgora,
  enviarTesteCampanha,
  salvarCampanha,
} from "@/app/admin/email-marketing/actions";
import {
  CORPO_INICIAL_CAMPANHA,
  EXEMPLO_CAMPANHA,
  SEGMENTO_LABELS,
  SEGMENTOS_ALUNOS,
  SEGMENTOS_LEADS,
  VARIAVEIS_CAMPANHA,
  isSegmentoEmail,
  type SegmentoEmail,
} from "@/lib/email/marketing-tipos";
import { renderizarTexto } from "@/lib/email/renderizar";
import {
  extrairBlocosDoHtml,
  gerarHtmlDeBlocos,
  htmlVeioDoEditorVisual,
  TEMPLATES_EMAIL,
  type BlocoEmail,
  type TemplateEmailId,
} from "@/lib/email/blocos-email";
import { EditorHtmlSimples } from "@/components/admin/editor-html-simples";
import { EditorEmailVisual } from "@/components/admin/editor-email-visual";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export type CampanhaEditavel = {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  segmento: SegmentoEmail;
  curso_id: string | null;
  leads_campanha_id: string | null;
  status: "rascunho" | "agendada";
  agendada_para: string | null;
};

export type CursoOpcao = { id: string; nome: string };
export type CampanhaMarketingOpcao = { id: string; nome: string };

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function EmailCampanhaEditor({
  campanha,
  cursos,
  campanhasMarketing,
}: {
  campanha: CampanhaEditavel | null;
  cursos: CursoOpcao[];
  campanhasMarketing: CampanhaMarketingOpcao[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [assunto, setAssunto] = useState(campanha?.assunto ?? "");
  const [corpo, setCorpo] = useState(campanha?.corpo_html ?? CORPO_INICIAL_CAMPANHA);
  const [segmento, setSegmento] = useState<SegmentoEmail>(campanha?.segmento ?? "todos");
  const [cursoId, setCursoId] = useState(campanha?.curso_id ?? "");
  const [leadsCampanhaId, setLeadsCampanhaId] = useState(campanha?.leads_campanha_id ?? "");

  const [modoEditor, setModoEditor] = useState<"visual" | "html">(() => (htmlVeioDoEditorVisual(corpo) ? "visual" : "html"));
  const [blocos, setBlocos] = useState<BlocoEmail[]>(() => extrairBlocosDoHtml(corpo) ?? []);
  const [avisoSobrescrever, setAvisoSobrescrever] = useState(false);

  const [resumo, setResumo] = useState<{ elegiveis: number; excluidos: number } | null>(null);
  const [contando, setContando] = useState(false);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [dataHora, setDataHora] = useState("");
  const [destinatarioTeste, setDestinatarioTeste] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [erroDialogo, setErroDialogo] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  const exigeCurso = segmento === "curso_especifico" || segmento === "leads_curso";

  // Estimativa de destinatários: recalcula quando segmento/curso/campanha de leads mudam.
  useEffect(() => {
    let cancelado = false;
    if (exigeCurso && !cursoId) {
      queueMicrotask(() => !cancelado && setResumo({ elegiveis: 0, excluidos: 0 }));
      return;
    }
    if (segmento === "leads_campanha" && !leadsCampanhaId) {
      queueMicrotask(() => !cancelado && setResumo({ elegiveis: 0, excluidos: 0 }));
      return;
    }
    queueMicrotask(() => !cancelado && setContando(true));
    contarDestinatarios(segmento, cursoId, leadsCampanhaId).then((r) => {
      if (cancelado) return;
      setResumo("elegiveis" in r ? { elegiveis: r.elegiveis, excluidos: r.excluidosDescadastro } : null);
      setContando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [segmento, cursoId, leadsCampanhaId, exigeCurso]);

  const previewHtml = useMemo(() => renderizarTexto(corpo, EXEMPLO_CAMPANHA, VARIAVEIS_CAMPANHA, { escapar: true }), [corpo]);
  const previewAssunto = useMemo(() => renderizarTexto(assunto, EXEMPLO_CAMPANHA, VARIAVEIS_CAMPANHA, { escapar: false }), [assunto]);

  const agendada = campanha?.status === "agendada";
  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));
  const campanhaItems = Object.fromEntries(campanhasMarketing.map((c) => [c.id, c.nome]));
  const segmentoItems = Object.fromEntries((SEGMENTOS_ALUNOS as readonly SegmentoEmail[]).concat(SEGMENTOS_LEADS).map((s) => [s, SEGMENTO_LABELS[s]]));

  function dados() {
    return { nome, assunto, corpoHtml: corpo, segmento, cursoId, leadsCampanhaId };
  }

  function aplicarBlocos(novosBlocos: BlocoEmail[]) {
    setBlocos(novosBlocos);
    setCorpo(gerarHtmlDeBlocos(novosBlocos));
  }

  function aplicarTemplate(id: TemplateEmailId) {
    aplicarBlocos(TEMPLATES_EMAIL[id].blocos());
  }

  // Troca de modo: HTML -> Visual tenta reconstruir os blocos a partir do marcador embutido no
  // HTML. Se o HTML foi editado manualmente desde então (ou nunca veio do editor visual), pede
  // confirmação antes de sobrescrever — a troca reconstrói a partir dos blocos (ou começa em
  // branco), perdendo a edição manual.
  function handleTrocarModo(novoModo: string) {
    if (novoModo !== "visual" && novoModo !== "html") return;
    if (novoModo === "html") {
      setModoEditor("html");
      return;
    }
    if (htmlVeioDoEditorVisual(corpo)) {
      setBlocos(extrairBlocosDoHtml(corpo) ?? []);
      setModoEditor("visual");
      return;
    }
    setAvisoSobrescrever(true);
  }

  function handleConfirmarSobrescrever() {
    setBlocos(extrairBlocosDoHtml(corpo) ?? []);
    setModoEditor("visual");
    setAvisoSobrescrever(false);
  }

  // Salva (cria ou atualiza) e devolve o id — todo envio/agendamento parte do que está salvo.
  async function salvar(): Promise<string | null> {
    const r = await salvarCampanha(campanha?.id ?? null, dados());
    if ("error" in r) {
      setMensagem({ tipo: "erro", texto: r.error });
      return null;
    }
    return r.id;
  }

  function handleSalvarRascunho() {
    setMensagem(null);
    startTransition(async () => {
      const id = await salvar();
      if (!id) return;
      if (!campanha) router.replace(`/admin/email-marketing/${id}/editar`);
      else {
        setMensagem({ tipo: "ok", texto: "Rascunho salvo." });
        router.refresh();
      }
    });
  }

  // "Enviar agora": salva, e só então pede a confirmação com o total de destinatários.
  function handleAbrirEnvio() {
    setMensagem(null);
    setErroDialogo(null);
    startTransition(async () => {
      const id = await salvar();
      if (!id) return;
      if (!campanha) {
        router.replace(`/admin/email-marketing/${id}/editar`);
        return;
      }
      setConfirmandoEnvio(true);
    });
  }

  function handleConfirmarEnvio() {
    if (!campanha) return;
    setErroDialogo(null);
    startTransition(async () => {
      const r = await enviarCampanhaAgora(campanha.id);
      if ("error" in r) {
        setErroDialogo(r.error);
        return;
      }
      router.push(`/admin/email-marketing/${campanha.id}`);
    });
  }

  function handleAbrirAgendamento() {
    setMensagem(null);
    setErroDialogo(null);
    startTransition(async () => {
      const id = await salvar();
      if (!id) return;
      if (!campanha) {
        router.replace(`/admin/email-marketing/${id}/editar`);
        return;
      }
      setAgendando(true);
    });
  }

  function handleConfirmarAgendamento() {
    if (!campanha) return;
    setErroDialogo(null);
    startTransition(async () => {
      const r = await agendarCampanha(campanha.id, dataHora);
      if (r.error) {
        setErroDialogo(r.error);
        return;
      }
      setAgendando(false);
      router.push("/admin/email-marketing");
    });
  }

  function handleDesagendar() {
    if (!campanha) return;
    setMensagem(null);
    startTransition(async () => {
      const r = await desagendarCampanha(campanha.id);
      if (r.error) setMensagem({ tipo: "erro", texto: r.error });
      else router.refresh();
    });
  }

  function handleTeste() {
    setMensagem(null);
    startTransition(async () => {
      const r = await enviarTesteCampanha(assunto, corpo, destinatarioTeste);
      setMensagem(r.ok ? { tipo: "ok", texto: `E-mail de teste enviado para ${destinatarioTeste}.` } : { tipo: "erro", texto: r.erro ?? "Não foi possível enviar." });
    });
  }

  const podeEnviar =
    nome.trim() &&
    assunto.trim() &&
    corpo.trim() &&
    (!exigeCurso || cursoId) &&
    (segmento !== "leads_campanha" || leadsCampanhaId);

  return (
    <div className="flex flex-col gap-6">
      {agendada && campanha?.agendada_para && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-400">
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Agendada para <strong>{formatarDataHora(campanha.agendada_para)}</strong> (sai na primeira execução diária do envio depois desse horário).
          </span>
          <Button type="button" size="sm" variant="outline" onClick={handleDesagendar} disabled={ocupado}>
            Cancelar agendamento
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="em-nome">Nome da campanha</Label>
            <Input id="em-nome" value={nome} maxLength={150} placeholder="Ex.: Matrículas abertas — outubro" onChange={(e) => setNome(e.target.value)} />
            <p className="text-muted-foreground text-xs">Só para você identificar; o aluno não vê.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="em-assunto">Assunto do e-mail</Label>
            <Input id="em-assunto" value={assunto} maxLength={300} onChange={(e) => setAssunto(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Variáveis (use no assunto ou no corpo)</Label>
            <div className="flex flex-wrap gap-1.5">
              {VARIAVEIS_CAMPANHA.map((variavel) => (
                <code key={variavel} className="rounded-md border px-2 py-1 text-xs">{`{${variavel}}`}</code>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Corpo do e-mail</Label>
              <Tabs value={modoEditor} onValueChange={handleTrocarModo}>
                <TabsList>
                  <TabsTrigger value="visual">🎨 Visual</TabsTrigger>
                  <TabsTrigger value="html">
                    <Code className="size-3.5" />
                    HTML
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {modoEditor === "visual" ? (
              <div className="flex flex-col gap-3">
                {!campanha && blocos.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col gap-2">
                      <Label>Começar de um modelo</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(TEMPLATES_EMAIL).map(([id, template]) => (
                          <Button key={id} type="button" variant="outline" size="sm" onClick={() => aplicarTemplate(id as TemplateEmailId)}>
                            {template.nome}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                <EditorEmailVisual blocos={blocos} onChange={aplicarBlocos} />
              </div>
            ) : (
              <EditorHtmlSimples id="em-corpo" value={corpo} onChange={setCorpo} />
            )}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="em-segmento">Segmento (quem recebe)</Label>
                <Select items={segmentoItems} value={segmento} onValueChange={(v) => v && isSegmentoEmail(v) && setSegmento(v)}>
                  <SelectTrigger id="em-segmento" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Alunos</SelectLabel>
                      {SEGMENTOS_ALUNOS.map((opcao) => (
                        <SelectItem key={opcao} value={opcao}>
                          {SEGMENTO_LABELS[opcao]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Leads</SelectLabel>
                      {SEGMENTOS_LEADS.map((opcao) => (
                        <SelectItem key={opcao} value={opcao}>
                          {SEGMENTO_LABELS[opcao]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {exigeCurso && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="em-curso">Curso</Label>
                  <Select items={cursoItems} value={cursoId} onValueChange={(v) => setCursoId(v ?? "")}>
                    <SelectTrigger id="em-curso" className="w-full">
                      <SelectValue placeholder="Escolha o curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {cursos.map((curso) => (
                        <SelectItem key={curso.id} value={curso.id}>
                          {curso.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {segmento === "leads_campanha" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="em-campanha">Campanha</Label>
                  <Select items={campanhaItems} value={leadsCampanhaId} onValueChange={(v) => setLeadsCampanhaId(v ?? "")}>
                    <SelectTrigger id="em-campanha" className="w-full">
                      <SelectValue placeholder="Escolha a campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {campanhasMarketing.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="bg-muted/50 flex items-center gap-2 rounded-md p-3 text-sm">
                <Users className="size-4" />
                {contando ? (
                  "Contando destinatários..."
                ) : resumo === null ? (
                  "Não foi possível estimar."
                ) : (
                  <span>
                    📧 <strong>{resumo.elegiveis}</strong> destinatário(s) elegível(eis) | ❌ <strong>{resumo.excluidos}</strong> excluído(s) (descadastro)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-col gap-1.5">
            <Label>Preview (com dados de exemplo)</Label>
            <p className="text-muted-foreground text-xs">
              Assunto: <strong>{previewAssunto || "—"}</strong>
            </p>
            <p className="text-muted-foreground text-xs">
              Todo e-mail de campanha recebe automaticamente, no fim, o link &quot;para não receber mais e-mails de marketing, clique aqui&quot; (LGPD) —
              não precisa incluí-lo no texto. Quem se descadastrou nunca entra na lista.
            </p>
            {/* sandbox="" : o HTML da campanha roda isolado, sem scripts nem acesso à página. */}
            <iframe sandbox="" srcDoc={previewHtml} title="Preview do e-mail" className="h-[30rem] w-full rounded-md border bg-white" />
          </div>

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <Label htmlFor="em-teste">Enviar e-mail de teste</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="em-teste"
                type="email"
                className="max-w-xs"
                placeholder="seu@email.com"
                value={destinatarioTeste}
                onChange={(e) => setDestinatarioTeste(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleTeste} disabled={ocupado || !destinatarioTeste.trim()}>
                <Mail />
                Enviar teste
              </Button>
            </div>
          </div>
        </div>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === "erro" ? "alert" : "status"}
          className={`text-sm ${mensagem.tipo === "erro" ? "text-destructive" : "text-green-600 dark:text-green-400"}`}
        >
          {mensagem.texto}
        </p>
      )}

      <div className="bg-background sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-2 border-t px-6 py-3">
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/email-marketing")} disabled={ocupado}>
          Voltar
        </Button>
        <Button type="button" variant="outline" onClick={handleSalvarRascunho} disabled={ocupado || !nome.trim()}>
          <Save />
          Salvar rascunho
        </Button>
        <Button type="button" variant="outline" onClick={handleAbrirAgendamento} disabled={ocupado || !podeEnviar}>
          <CalendarClock />
          Agendar
        </Button>
        <Button type="button" onClick={handleAbrirEnvio} disabled={ocupado || !podeEnviar}>
          <Send />
          Enviar agora
        </Button>
      </div>

      <AlertDialog open={confirmandoEnvio} onOpenChange={(aberto) => !ocupado && setConfirmandoEnvio(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar campanha agora</AlertDialogTitle>
            <AlertDialogDescription>
              Serão enviados <strong>{resumo?.elegiveis ?? "?"}</strong> e-mail(s) — {SEGMENTO_LABELS[segmento].toLowerCase()}. O envio é em lotes
              (cerca de 100 e-mails por minuto, para respeitar o limite do provedor) e não pode ser desfeito depois de começar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erroDialogo && (
            <p role="alert" className="text-destructive text-sm">
              {erroDialogo}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={ocupado || resumo?.elegiveis === 0} onClick={handleConfirmarEnvio}>
              {ocupado ? "Iniciando..." : "Enviar agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={agendando} onOpenChange={(aberto) => !ocupado && setAgendando(aberto)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar envio</DialogTitle>
            <DialogDescription>
              Escolha quando enviar para ~{resumo?.elegiveis ?? "?"} destinatário(s). Horário de Brasília. O envio roda uma vez por dia:
              a campanha sai na primeira execução depois do horário marcado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="em-quando">Data e hora</Label>
            <Input id="em-quando" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
          </div>
          {erroDialogo && (
            <p role="alert" className="text-destructive text-sm">
              {erroDialogo}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAgendando(false)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmarAgendamento} disabled={ocupado || !dataHora}>
              {ocupado ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={avisoSobrescrever} onOpenChange={setAvisoSobrescrever}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este HTML foi editado manualmente</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual não corresponde ao que o editor visual geraria. Trocar para o modo Visual agora vai reconstruir o e-mail a partir dos
              últimos blocos conhecidos (ou começar em branco, se não houver nenhum) — as edições feitas direto no HTML serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar em HTML</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarSobrescrever}>Trocar para Visual</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
