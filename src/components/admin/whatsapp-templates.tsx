"use client";

// "use client": lista + editor em diálogo (texto, ativo, prévia, restaurar padrão, teste).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Send } from "lucide-react";
import { enviarTesteWhatsapp, salvarTemplateWhatsapp } from "@/app/admin/configuracoes/whatsapp/actions";
import {
  renderizarTemplateWhatsapp,
  valoresDeExemplo,
  WHATSAPP_TEMPLATES,
  type WhatsappTemplateId,
} from "@/lib/whatsapp/templates";
import { SmsCampoMensagem } from "@/components/admin/sms-campo-mensagem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const LIMITE_MENSAGEM = 1000;

export type TemplateEdicao = { id: WhatsappTemplateId; mensagem: string; ativo: boolean };

function EditorTemplate({ inicial, onFechar }: { inicial: TemplateEdicao; onFechar: () => void }) {
  const router = useRouter();
  const definicao = WHATSAPP_TEMPLATES[inicial.id];
  const [mensagem, setMensagem] = useState(inicial.mensagem);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; erro?: string } | null>(null);
  const [enviandoTeste, startTeste] = useTransition();

  const alterado = mensagem !== inicial.mensagem || ativo !== inicial.ativo;
  const previa = renderizarTemplateWhatsapp(mensagem, valoresDeExemplo(definicao.placeholders));

  function salvar() {
    setErro(null);
    startSalvar(async () => {
      const r = await salvarTemplateWhatsapp({ id: inicial.id, mensagem, ativo });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      router.refresh();
      onFechar();
    });
  }

  function enviarTeste() {
    setResultadoTeste(null);
    startTeste(async () => {
      const r = await enviarTesteWhatsapp(telefoneTeste, previa);
      setResultadoTeste(r);
    });
  }

  return (
    <Dialog open onOpenChange={(aberto) => !salvando && !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{definicao.nome}</DialogTitle>
          <DialogDescription>{definicao.gatilho}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SmsCampoMensagem
            id={`wa-tpl-${inicial.id}`}
            rotulo="Mensagem"
            valor={mensagem}
            onChange={setMensagem}
            placeholders={definicao.placeholders}
            limite={LIMITE_MENSAGEM}
            linhas={5}
            desabilitado={salvando}
          />

          <div className="bg-muted/40 flex flex-col gap-1 rounded-md p-3">
            <span className="text-muted-foreground text-xs">Prévia com dados de exemplo</span>
            <p className="text-sm break-words whitespace-pre-wrap">{previa || "—"}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`wa-tpl-ativo-${inicial.id}`}>Ativo</Label>
              <p className="text-muted-foreground text-xs">Desativado, o sistema usa a mensagem padrão do código (o envio continua).</p>
            </div>
            <Switch id={`wa-tpl-ativo-${inicial.id}`} checked={ativo} onCheckedChange={setAtivo} disabled={salvando} />
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <Label htmlFor={`wa-tpl-teste-${inicial.id}`}>Enviar teste (usa a prévia acima)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`wa-tpl-teste-${inicial.id}`}
                value={telefoneTeste}
                onChange={(e) => setTelefoneTeste(e.target.value)}
                placeholder="11999999999"
                disabled={enviandoTeste}
                className="max-w-40"
              />
              <Button type="button" variant="outline" size="sm" disabled={enviandoTeste || !telefoneTeste.trim()} onClick={enviarTeste}>
                <Send />
                {enviandoTeste ? "Enviando..." : "Enviar teste"}
              </Button>
            </div>
            {resultadoTeste?.ok && (
              <span role="status" className="text-sm text-green-600 dark:text-green-400">
                Mensagem de teste enviada.
              </span>
            )}
            {resultadoTeste && !resultadoTeste.ok && (
              <span role="alert" className="text-destructive text-sm">
                {resultadoTeste.erro}
              </span>
            )}
          </div>

          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={salvando || mensagem === definicao.padrao}
            onClick={() => setMensagem(definicao.padrao)}
          >
            <RotateCcw />
            Restaurar padrão
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={salvando} onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvando || !alterado || !mensagem.trim()} onClick={salvar}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsappTemplatesLista({ templates }: { templates: TemplateEdicao[] }) {
  const [editando, setEditando] = useState<TemplateEdicao | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        13 mensagens automáticas do sistema. Clique num template para editar o texto, os
        <code> {"{placeholders}"}</code> disponíveis e se ele está ativo.
      </p>

      <ul className="flex flex-col gap-2">
        {templates.map((t) => {
          const definicao = WHATSAPP_TEMPLATES[t.id];
          return (
            <li key={t.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <button type="button" className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left" onClick={() => setEditando(t)}>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {definicao.nome}
                      {!t.ativo && <Badge variant="outline">Inativo (usando padrão)</Badge>}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">{definicao.gatilho}</span>
                  </button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditando(t)}>
                    Editar
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {editando && <EditorTemplate inicial={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
