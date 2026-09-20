"use client";

// "use client": formulário com estado, contador de caracteres e Server Actions.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, MessageCircle, Send, XCircle } from "lucide-react";
import { enviarSmsTeste, salvarIntegrax } from "@/app/admin/configuracoes/apps/integrax/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const LIMITE = 160;
const WHATSAPP_SUPORTE = "https://wa.me/551132808396";

export function IntegraxForm({
  temToken,
  ativoInicial,
  criptografiaConfigurada,
}: {
  // O token em si NUNCA vem do servidor — só se existe um salvo.
  temToken: boolean;
  ativoInicial: boolean;
  criptografiaConfigurada: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [removerToken, setRemoverToken] = useState(false);
  const [ativo, setAtivo] = useState(ativoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; erro?: string } | null>(null);
  const [enviando, startEnviar] = useTransition();

  function handleSalvar() {
    setErro(null);
    setSalvo(false);
    startSalvar(async () => {
      const resultado = await salvarIntegrax({ token, removerToken, ativo });
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setToken("");
      setRemoverToken(false);
      setSalvo(true);
      router.refresh();
    });
  }

  function handleEnviarTeste() {
    setResultadoTeste(null);
    startEnviar(async () => {
      setResultadoTeste(await enviarSmsTeste(telefone, mensagem));
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="integrax-token">Token da API</Label>
            <Input
              id="integrax-token"
              type="password"
              autoComplete="off"
              value={token}
              disabled={removerToken}
              placeholder={temToken ? "•••••••• token salvo — deixe em branco para manter" : "Cole aqui o token fornecido pela IntegraX"}
              onChange={(e) => setToken(e.target.value)}
            />
            {temToken && (
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <Checkbox checked={removerToken} onCheckedChange={(marcado) => setRemoverToken(marcado === true)} />
                Remover o token salvo
              </label>
            )}
            <p className="text-muted-foreground text-xs">
              {temToken ? "Há um token salvo (criptografado). Ele nunca é exibido de novo." : "Nenhum token salvo ainda."}
            </p>
          </div>

          <p className="flex gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              O token precisa ser <strong>ativado pelo suporte da IntegraX</strong> antes do primeiro envio. Se o teste
              retornar erro de autorização, peça a ativação pelo WhatsApp.
            </span>
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-fit"
            nativeButton={false}
            render={<a href={WHATSAPP_SUPORTE} target="_blank" rel="noreferrer" />}
          >
            <MessageCircle />
            Suporte IntegraX: +55 11 3280-8396
          </Button>

          <label className="flex items-center justify-between gap-3 border-t pt-4">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Integração ativa</span>
              <span className="text-muted-foreground text-xs">
                Ligada, o sistema envia SMS de boas-vindas (matrícula), confirmação de pagamento e aviso de cobrança.
                Desligada, o texto que seria enviado só aparece no log do servidor.
              </span>
            </span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>

          {!criptografiaConfigurada && (
            <p role="alert" className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">
              A variável de ambiente GATEWAYS_ENCRYPTION_KEY não está definida: não é possível salvar o token até
              configurá-la.
            </p>
          )}
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
          {salvo && !erro && <p className="text-sm text-green-600 dark:text-green-400">Configuração salva.</p>}

          <Button type="button" className="w-fit" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testar envio</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Envia um SMS de verdade com o token salvo (mesmo com a integração desativada). Salve o token antes de testar.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="integrax-telefone">Telefone com DDD</Label>
            <Input
              id="integrax-telefone"
              type="tel"
              inputMode="tel"
              placeholder="11999999999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="integrax-mensagem">Mensagem</Label>
            <Textarea
              id="integrax-mensagem"
              rows={3}
              maxLength={LIMITE}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value.slice(0, LIMITE))}
            />
            <span className="text-muted-foreground self-end text-xs tabular-nums">
              {mensagem.length}/{LIMITE} caracteres
            </span>
          </div>

          {resultadoTeste && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                resultadoTeste.ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"
              }`}
            >
              {resultadoTeste.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
              {resultadoTeste.ok ? "SMS enviado para a IntegraX." : (resultadoTeste.erro ?? "Não foi possível enviar.")}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={handleEnviarTeste}
            disabled={enviando || !telefone.trim() || !mensagem.trim()}
          >
            <Send />
            {enviando ? "Enviando..." : "Enviar teste"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
