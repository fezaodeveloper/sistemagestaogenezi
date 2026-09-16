"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, Send } from "lucide-react";
import { enviarNotificacaoPush } from "@/app/admin/notificacoes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const URL_PERSONALIZADO = "personalizado";

const URL_OPCOES: Record<string, string> = {
  "/aluno": "Início",
  "/aluno/cursos": "Meus cursos",
  "/aluno/financeiro": "Financeiro",
  "/aluno/gamificacao": "Gamificação",
  [URL_PERSONALIZADO]: "Personalizado",
};

const TITULO_MAX = 50;
const CORPO_MAX = 150;
const HISTORICO_STORAGE_KEY = "genezi-notificacoes-push-historico";
const HISTORICO_MAXIMO = 20;

type HistoricoItem = {
  id: string;
  titulo: string;
  corpo: string;
  url: string;
  quantidade: number;
  dataHora: string;
};

// Histórico só neste navegador (localStorage) — sem migration por enquanto
// (roadmap, item 7); vira tabela compartilhada entre admins/dispositivos se
// o volume justificar mais adiante.
function lerHistorico(): HistoricoItem[] {
  try {
    const bruto = localStorage.getItem(HISTORICO_STORAGE_KEY);
    return bruto ? (JSON.parse(bruto) as HistoricoItem[]) : [];
  } catch {
    return [];
  }
}

function salvarHistorico(historico: HistoricoItem[]) {
  try {
    localStorage.setItem(HISTORICO_STORAGE_KEY, JSON.stringify(historico.slice(0, HISTORICO_MAXIMO)));
  } catch {
    // Modo privado ou storage bloqueado — histórico simplesmente não persiste.
  }
}

export function NotificacoesAdminView({ totalDispositivos }: { totalDispositivos: number }) {
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [urlSelecionada, setUrlSelecionada] = useState("/aluno");
  const [urlPersonalizada, setUrlPersonalizada] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect) — leitura de localStorage só existe
    // no client, precisa rodar depois do mount.
    queueMicrotask(() => setHistorico(lerHistorico()));
  }, []);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSucesso(null);

    const urlFinal = urlSelecionada === URL_PERSONALIZADO ? urlPersonalizada.trim() : urlSelecionada;
    if (urlSelecionada === URL_PERSONALIZADO && !urlFinal) {
      setError("Informe a URL personalizada.");
      return;
    }
    formData.set("url", urlFinal);

    startTransition(async () => {
      const resultado = await enviarNotificacaoPush(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }

      setSucesso(`Notificação enviada para ${resultado.quantidade} dispositivo(s).`);
      const item: HistoricoItem = {
        id: crypto.randomUUID(),
        titulo,
        corpo,
        url: urlFinal,
        quantidade: resultado.quantidade,
        dataHora: new Date().toISOString(),
      };
      setHistorico((prev) => {
        const novo = [item, ...prev].slice(0, HISTORICO_MAXIMO);
        salvarHistorico(novo);
        return novo;
      });
      setTitulo("");
      setCorpo("");
      formRef.current?.reset();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-md">
        <CardContent className="flex items-center gap-3">
          <Bell className="text-muted-foreground size-5" />
          <div>
            <p className="text-2xl font-semibold">{totalDispositivos}</p>
            <p className="text-muted-foreground text-sm">
              dispositivo{totalDispositivos === 1 ? "" : "s"} com notificações ativas
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardContent>
          <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="titulo">Título da notificação</Label>
              <Input
                id="titulo"
                name="titulo"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value.slice(0, TITULO_MAX))}
                maxLength={TITULO_MAX}
                required
              />
              <span className="text-muted-foreground self-end text-xs">
                {titulo.length}/{TITULO_MAX}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="corpo">Corpo da mensagem</Label>
              <Textarea
                id="corpo"
                name="corpo"
                rows={3}
                value={corpo}
                onChange={(event) => setCorpo(event.target.value.slice(0, CORPO_MAX))}
                maxLength={CORPO_MAX}
                required
              />
              <span className="text-muted-foreground self-end text-xs">
                {corpo.length}/{CORPO_MAX}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="url">URL de destino</Label>
              <Select
                items={URL_OPCOES}
                value={urlSelecionada}
                onValueChange={(value) => setUrlSelecionada(value as string)}
              >
                <SelectTrigger id="url" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(URL_OPCOES).map((chave) => (
                    <SelectItem key={chave} value={chave}>
                      {URL_OPCOES[chave]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {urlSelecionada === URL_PERSONALIZADO && (
                <Input
                  value={urlPersonalizada}
                  onChange={(event) => setUrlPersonalizada(event.target.value)}
                  placeholder="/aluno/..."
                />
              )}
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            {sucesso && !error && <p className="text-sm text-green-600 dark:text-green-400">{sucesso}</p>}

            <Button type="submit" disabled={isPending}>
              <Send />
              {isPending ? "Enviando..." : "Enviar notificação para todos"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {historico.length > 0 && (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium">Histórico de envios (neste navegador)</p>
            <div className="flex flex-col gap-2">
              {historico.map((item) => (
                <div key={item.id} className="border-b pb-2 text-sm last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{item.titulo}</p>
                    <Badge variant="outline">{item.quantidade} dispositivo(s)</Badge>
                  </div>
                  <p className="text-muted-foreground">{item.corpo}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(item.dataHora).toLocaleString("pt-BR")} · {item.url}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
