"use client";

// "use client": editor com preview ao vivo, cópia de placeholders e Server Actions.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, RotateCcw, Save } from "lucide-react";
import { enviarEmailTeste, restaurarTemplate, salvarTemplate } from "@/app/admin/configuracoes/email/actions";
import { renderizarTexto } from "@/lib/email/renderizar";
import { EditorHtmlSimples } from "@/components/admin/editor-html-simples";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export type TemplateItem = {
  id: string;
  nome: string;
  descricao: string;
  assunto: string;
  corpo_html: string;
  variaveis: string[];
  ativo: boolean;
  exemplo: Record<string, string>;
};

function EditorTemplate({ template }: { template: TemplateItem }) {
  const router = useRouter();
  const [assunto, setAssunto] = useState(template.assunto);
  const [corpo, setCorpo] = useState(template.corpo_html);
  const [ativo, setAtivo] = useState(template.ativo);
  const [destinatario, setDestinatario] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [restaurando, startRestaurar] = useTransition();
  const [enviando, startEnviar] = useTransition();

  const alterado = assunto !== template.assunto || corpo !== template.corpo_html || ativo !== template.ativo;

  // Preview ao vivo: mesma função do envio, com os valores de exemplo.
  const previewHtml = useMemo(
    () => renderizarTexto(corpo, template.exemplo, template.variaveis, { escapar: true }),
    [corpo, template.exemplo, template.variaveis],
  );
  const previewAssunto = useMemo(
    () => renderizarTexto(assunto, template.exemplo, template.variaveis, { escapar: false }),
    [assunto, template.exemplo, template.variaveis],
  );

  function copiar(variavel: string) {
    navigator.clipboard
      .writeText(`{${variavel}}`)
      .then(() => {
        setCopiado(variavel);
        setTimeout(() => setCopiado(null), 1500);
      })
      .catch(() => setMensagem({ tipo: "erro", texto: "Não foi possível copiar. Digite o placeholder manualmente." }));
  }

  function salvar() {
    setMensagem(null);
    startSalvar(async () => {
      const r = await salvarTemplate(template.id, { assunto, corpoHtml: corpo, ativo });
      if (r.error) setMensagem({ tipo: "erro", texto: r.error });
      else {
        setMensagem({ tipo: "ok", texto: "Template salvo." });
        router.refresh();
      }
    });
  }

  function restaurar() {
    setMensagem(null);
    startRestaurar(async () => {
      const r = await restaurarTemplate(template.id);
      setConfirmandoRestaurar(false);
      if ("error" in r && r.error) {
        setMensagem({ tipo: "erro", texto: r.error });
        return;
      }
      if ("assunto" in r) {
        setAssunto(r.assunto);
        setCorpo(r.corpoHtml);
        setAtivo(true);
      }
      setMensagem({ tipo: "ok", texto: "Template restaurado para o padrão." });
      router.refresh();
    });
  }

  function enviarTeste() {
    setMensagem(null);
    startEnviar(async () => {
      const r = await enviarEmailTeste(template.id, destinatario, assunto, corpo);
      setMensagem(r.ok ? { tipo: "ok", texto: `E-mail de teste enviado para ${destinatario}.` } : { tipo: "erro", texto: r.erro ?? "Não foi possível enviar." });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{template.nome}</span>
          <label className="flex items-center gap-2 text-xs font-normal">
            <span className="text-muted-foreground">E-mail ativo</span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>
        </CardTitle>
        <p className="text-muted-foreground text-sm">{template.descricao}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!ativo && (
          <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            Este e-mail está desativado: o sistema não o envia enquanto o toggle estiver desligado (depois de salvar).
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-assunto">Assunto</Label>
          <Input id="tpl-assunto" value={assunto} maxLength={300} onChange={(e) => setAssunto(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Placeholders disponíveis (clique para copiar)</Label>
          <div className="flex flex-wrap gap-1.5">
            {template.variaveis.map((variavel) => (
              <button
                key={variavel}
                type="button"
                onClick={() => copiar(variavel)}
                className="hover:bg-accent flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors"
              >
                <Copy className="size-3" />
                {copiado === variavel ? "copiado!" : `{${variavel}}`}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Para mostrar um trecho só quando a variável tiver valor: <code>{"{#se link_pix} ... {/se}"}</code>.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-corpo">Corpo (HTML)</Label>
          <EditorHtmlSimples id="tpl-corpo" value={corpo} onChange={setCorpo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Preview (com dados de exemplo)</Label>
          <p className="text-muted-foreground text-xs">
            Assunto: <strong>{previewAssunto}</strong>
          </p>
          {/* sandbox="" : o HTML do template roda isolado, sem scripts nem acesso à página. */}
          <iframe sandbox="" srcDoc={previewHtml} title="Preview do e-mail" className="h-[26rem] w-full rounded-md border bg-white" />
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <Label htmlFor="tpl-teste">Enviar e-mail de teste</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="tpl-teste"
              type="email"
              className="max-w-xs"
              placeholder="destinatario@exemplo.com"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={enviarTeste} disabled={enviando || !destinatario.trim()}>
              <Mail />
              {enviando ? "Enviando..." : "Enviar teste"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Envia o que está no editor (mesmo sem salvar), pelo provedor em uso.</p>
        </div>

        {mensagem && (
          <p
            role={mensagem.tipo === "erro" ? "alert" : "status"}
            className={`text-sm ${mensagem.tipo === "erro" ? "text-destructive" : "text-green-600 dark:text-green-400"}`}
          >
            {mensagem.texto}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmandoRestaurar(true)} disabled={restaurando}>
            <RotateCcw />
            Restaurar padrão
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando || !alterado}>
            <Save />
            {salvando ? "Salvando..." : "Salvar template"}
          </Button>
        </div>

        <AlertDialog open={confirmandoRestaurar} onOpenChange={setConfirmandoRestaurar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar template padrão</AlertDialogTitle>
              <AlertDialogDescription>
                O assunto e o corpo voltam ao texto original do sistema e o e-mail é reativado. As suas alterações neste
                template serão perdidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={restaurando} onClick={restaurar}>
                {restaurando ? "Restaurando..." : "Restaurar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function EmailTemplates({ templates }: { templates: TemplateItem[] }) {
  const [selecionadoId, setSelecionadoId] = useState(templates[0]?.id ?? "");
  const selecionado = templates.find((t) => t.id === selecionadoId) ?? templates[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setSelecionadoId(template.id)}
            aria-pressed={template.id === selecionado?.id}
            className={`rounded-lg border p-3 text-left transition-colors ${
              template.id === selecionado?.id ? "border-primary bg-primary/5" : "hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{template.nome}</p>
              {!template.ativo && <Badge variant="secondary">Desativado</Badge>}
            </div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{template.assunto}</p>
          </button>
        ))}
      </div>

      {/* key: trocar de template recomeça o editor com o conteúdo dele. */}
      {selecionado && <EditorTemplate key={selecionado.id} template={selecionado} />}
    </div>
  );
}
