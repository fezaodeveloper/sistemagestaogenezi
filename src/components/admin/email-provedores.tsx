"use client";

// "use client": cards de provedor, formulários com estado, teste de conexão e Server Actions.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, PlugZap, XCircle } from "lucide-react";
import { salvarProvedor, testarProvedorEmail, type DadosProvedorForm } from "@/app/admin/configuracoes/email/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type ProvedorId = "resend" | "smtp" | "sendgrid";

export type DadosProvedores = {
  emUso: ProvedorId;
  criptografiaConfigurada: boolean;
  // Só booleanos pros segredos: a chave/senha em si nunca chega ao navegador.
  resend: { temChave: boolean; chaveNoAmbiente: boolean; fromName: string; fromEmail: string };
  smtp: { host: string; porta: number; usuario: string; temSenha: boolean; ssl: boolean; fromName: string; fromEmail: string };
  sendgrid: { temChave: boolean; fromName: string; fromEmail: string };
};

const CARDS: { id: ProvedorId; nome: string; descricao: string; cor: string }[] = [
  { id: "resend", nome: "Resend", descricao: "API moderna de e-mail transacional. É o provedor em uso hoje.", cor: "#111827" },
  { id: "smtp", nome: "SMTP", descricao: "Qualquer servidor SMTP (Gmail, Outlook, Zoho, servidor próprio).", cor: "#0EA5E9" },
  { id: "sendgrid", nome: "SendGrid", descricao: "Plataforma de e-mail da Twilio, via API.", cor: "#1A82E2" },
];

function ConfiguradoBadge({ ok }: { ok: boolean }) {
  return (
    <Badge className={ok ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400" : "bg-muted text-muted-foreground"}>
      {ok ? "Configurado" : "Não configurado"}
    </Badge>
  );
}

// Um formulário por provedor; o pai controla qual está visível.
function FormProvedor({ provedor, dados }: { provedor: ProvedorId; dados: DadosProvedores }) {
  const router = useRouter();
  const emUso = dados.emUso === provedor;

  const [apiKey, setApiKey] = useState("");
  const [fromName, setFromName] = useState(dados[provedor === "smtp" ? "smtp" : provedor].fromName);
  const [fromEmail, setFromEmail] = useState(dados[provedor === "smtp" ? "smtp" : provedor].fromEmail);
  const [host, setHost] = useState(dados.smtp.host);
  const [porta, setPorta] = useState(String(dados.smtp.porta));
  const [usuario, setUsuario] = useState(dados.smtp.usuario);
  const [senha, setSenha] = useState("");
  const [ssl, setSsl] = useState(dados.smtp.ssl);
  const [usar, setUsar] = useState(emUso);

  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; erro?: string; aviso?: string } | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [testando, startTestar] = useTransition();

  function montar(): DadosProvedorForm {
    if (provedor === "smtp") {
      return { provedor, host, porta: Number(porta), usuario, senha, ssl, fromName, fromEmail };
    }
    return { provedor, apiKey, fromName, fromEmail };
  }

  function handleSalvar() {
    setErro(null);
    setSalvo(false);
    setTeste(null);
    startSalvar(async () => {
      const resultado = await salvarProvedor(montar(), usar);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setApiKey("");
      setSenha("");
      setSalvo(true);
      router.refresh();
    });
  }

  function handleTestar() {
    setErro(null);
    setSalvo(false);
    setTeste(null);
    startTestar(async () => setTeste(await testarProvedorEmail(montar())));
  }

  const temSegredoSalvo = provedor === "resend" ? dados.resend.temChave : provedor === "sendgrid" ? dados.sendgrid.temChave : dados.smtp.temSenha;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar {CARDS.find((c) => c.id === provedor)?.nome}</CardTitle>
      </CardHeader>
      <CardContent className="flex max-w-xl flex-col gap-4">
        {provedor === "resend" && dados.resend.chaveNoAmbiente && !dados.resend.temChave && (
          <p className="text-muted-foreground bg-muted/50 flex gap-2 rounded-md p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            Hoje o Resend usa a chave da variável de ambiente RESEND_API_KEY do servidor. Deixe o campo em branco para
            continuar assim, ou preencha para passar a usar uma chave guardada aqui.
          </p>
        )}

        {provedor === "smtp" ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smtp-host">Servidor (host)</Label>
                <Input id="smtp-host" value={host} placeholder="smtp.exemplo.com" onChange={(e) => setHost(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smtp-porta">Porta</Label>
                <Input id="smtp-porta" type="number" inputMode="numeric" value={porta} onChange={(e) => setPorta(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smtp-usuario">Usuário</Label>
                <Input id="smtp-usuario" autoComplete="off" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smtp-senha">Senha</Label>
                <Input
                  id="smtp-senha"
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  placeholder={dados.smtp.temSenha ? "•••••••• salva — em branco mantém" : ""}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Usar SSL/TLS</span>
                <span className="text-muted-foreground text-xs">Porta 465 usa TLS direto; as demais (ex.: 587) usam STARTTLS.</span>
              </span>
              <Switch checked={ssl} onCheckedChange={setSsl} />
            </label>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${provedor}-key`}>API Key</Label>
            <Input
              id={`${provedor}-key`}
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder={
                temSegredoSalvo ? "•••••••• chave salva — deixe em branco para manter" : provedor === "resend" ? "re_..." : "SG...."
              }
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${provedor}-from-name`}>Nome do remetente</Label>
            <Input id={`${provedor}-from-name`} value={fromName} placeholder="GÊNEZI Educação" onChange={(e) => setFromName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${provedor}-from-email`}>E-mail do remetente</Label>
            <Input
              id={`${provedor}-from-email`}
              type="email"
              value={fromEmail}
              placeholder="no-reply@seudominio.com.br"
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
        </div>
        <p className="text-muted-foreground -mt-2 text-xs">
          {provedor === "resend"
            ? "O domínio do remetente precisa estar verificado no Resend. Em branco, usa RESEND_FROM_EMAIL do ambiente."
            : provedor === "sendgrid"
              ? "O remetente precisa estar verificado no SendGrid (Sender Authentication)."
              : "Muitos servidores só aceitam enviar com o mesmo e-mail (ou domínio) do usuário autenticado."}
        </p>

        <label className="flex items-center justify-between gap-3 border-t pt-4">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Usar este provedor</span>
            <span className="text-muted-foreground text-xs">
              {emUso ? "É o provedor em uso agora." : "Ao salvar, os e-mails do sistema passam a sair por ele."}
            </span>
          </span>
          <Switch checked={usar} onCheckedChange={setUsar} disabled={emUso} />
        </label>

        {!dados.criptografiaConfigurada && (
          <p role="alert" className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">
            A variável de ambiente GATEWAYS_ENCRYPTION_KEY não está definida: não é possível salvar chaves e senhas até
            configurá-la.
          </p>
        )}

        {teste && (
          <p
            role="status"
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              teste.ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"
            }`}
          >
            {teste.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
            <span className="flex flex-col gap-1">
              <span>{teste.ok ? "Conexão realizada com sucesso." : (teste.erro ?? "Não foi possível conectar.")}</span>
              {teste.ok && teste.aviso && <span className="text-xs opacity-90">{teste.aviso}</span>}
            </span>
          </p>
        )}
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        {salvo && !erro && <p className="text-sm text-green-600 dark:text-green-400">Configuração salva.</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleTestar} disabled={testando || salvando}>
            <PlugZap />
            {testando ? "Testando..." : "Testar conexão"}
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando || testando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmailProvedores({ dados }: { dados: DadosProvedores }) {
  const [selecionado, setSelecionado] = useState<ProvedorId>(dados.emUso);

  const configurado: Record<ProvedorId, boolean> = {
    resend: dados.resend.temChave || dados.resend.chaveNoAmbiente,
    smtp: !!dados.smtp.host && !!dados.smtp.fromEmail,
    sendgrid: dados.sendgrid.temChave && !!dados.sendgrid.fromEmail,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelecionado(card.id)}
            aria-pressed={selecionado === card.id}
            className="group text-left"
          >
            <Card className={`h-full transition-colors ${selecionado === card.id ? "border-primary" : "group-hover:border-primary/50"}`}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: card.cor }}
                  >
                    {card.nome.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {dados.emUso === card.id && <Badge className="bg-primary text-primary-foreground">Em uso</Badge>}
                    <ConfiguradoBadge ok={configurado[card.id]} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{card.nome}</p>
                  <p className="text-muted-foreground text-sm">{card.descricao}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* key: trocar de provedor recomeça o formulário com os valores dele. */}
      <FormProvedor key={selecionado} provedor={selecionado} dados={dados} />
    </div>
  );
}
