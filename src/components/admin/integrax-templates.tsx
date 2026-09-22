"use client";

// "use client": estado de cada template (texto, ativo), prévia em tempo real e Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { salvarTemplateSms } from "@/app/admin/configuracoes/apps/integrax/actions";
import { SMS_LIMITE_CARACTERES } from "@/lib/integrax/texto";
import {
  SMS_TEMPLATES,
  renderizarSms,
  valoresDeExemplo,
  type SmsTemplateId,
} from "@/lib/integrax/templates";
import { SmsCampoMensagem } from "@/components/admin/sms-campo-mensagem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type TemplateEdicao = { id: SmsTemplateId; mensagem: string; ativo: boolean };

function TemplateCard({ inicial }: { inicial: TemplateEdicao }) {
  const router = useRouter();
  const definicao = SMS_TEMPLATES[inicial.id];
  const [mensagem, setMensagem] = useState(inicial.mensagem);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [salvo, setSalvo] = useState({ mensagem: inicial.mensagem, ativo: inicial.ativo });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const alterado = mensagem !== salvo.mensagem || ativo !== salvo.ativo;
  const previa = renderizarSms(mensagem, valoresDeExemplo(definicao.placeholders), definicao.encurtaveis);

  function salvar() {
    setErro(null);
    setOk(false);
    startSalvar(async () => {
      const r = await salvarTemplateSms({ id: inicial.id, mensagem, ativo });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setSalvo({ mensagem: mensagem.trim(), ativo });
      setMensagem(mensagem.trim());
      setOk(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {definicao.nome}
              {definicao.gatilho === null && <Badge variant="outline">Sem disparo automático ainda</Badge>}
            </CardTitle>
            <p className="text-muted-foreground text-xs">{definicao.gatilho ?? "O sistema ainda não possui um evento que envie este SMS; o texto fica pronto para quando existir."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`tpl-ativo-${inicial.id}`} className="text-sm">
              Ativo
            </Label>
            <Switch id={`tpl-ativo-${inicial.id}`} checked={ativo} onCheckedChange={setAtivo} disabled={salvando} />
          </div>
        </div>
        {!ativo && (
          <p className="text-muted-foreground text-xs">
            Desativado: o sistema envia a mensagem padrão do código (o SMS continua sendo enviado).
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SmsCampoMensagem
          id={`tpl-msg-${inicial.id}`}
          rotulo="Mensagem"
          valor={mensagem}
          onChange={(v) => {
            setMensagem(v);
            setOk(false);
          }}
          placeholders={definicao.placeholders}
          desabilitado={salvando}
        />

        <div className="bg-muted/40 flex flex-col gap-1 rounded-md p-3">
          <span className="text-muted-foreground text-xs">
            Prévia com dados de exemplo ({previa.length}/{SMS_LIMITE_CARACTERES} caracteres — acentos são removidos no envio)
          </span>
          <p className="text-sm break-words">{previa || "—"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={salvar} disabled={salvando || !alterado || !mensagem.trim()}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={salvando || mensagem === definicao.padrao}
            onClick={() => {
              setMensagem(definicao.padrao);
              setOk(false);
            }}
          >
            <RotateCcw />
            Restaurar padrão
          </Button>
          {ok && !alterado && (
            <span role="status" className="text-sm text-green-600 dark:text-green-400">
              Salvo.
            </span>
          )}
          {erro && (
            <span role="alert" className="text-destructive text-sm">
              {erro}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegraxTemplates({ templates }: { templates: TemplateEdicao[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Edite o texto de cada SMS. Os <code>{"{placeholders}"}</code> são trocados pelos dados reais no envio. O limite é de{" "}
        {SMS_LIMITE_CARACTERES} caracteres; se o SMS final passar disso, o nome do curso é abreviado.
      </p>
      {templates.map((t) => (
        <TemplateCard key={t.id} inicial={t} />
      ))}
    </div>
  );
}
