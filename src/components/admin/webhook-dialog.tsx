"use client";

// "use client": formulário com estado e envio por Server Action.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarWebhook, type DadosWebhookForm } from "@/app/admin/configuracoes/apps/webhooks/actions";
import {
  WEBHOOK_EVENTOS,
  WEBHOOK_EVENTO_DESCRICOES,
  WEBHOOK_EVENTO_LABELS,
  type WebhookEvento,
} from "@/lib/webhooks/eventos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type WebhookItem = {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  cursos_ids: string[];
  ativo: boolean;
  // O token em si NUNCA vem do servidor — só se existe um salvo.
  temToken: boolean;
  created_at: string;
};

export type CursoOpcao = { id: string; nome: string };

export function WebhookDialog({
  webhook,
  cursos,
  onClose,
}: {
  // null = novo webhook.
  webhook: WebhookItem | null;
  cursos: CursoOpcao[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(webhook?.nome ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [bearerToken, setBearerToken] = useState("");
  const [removerToken, setRemoverToken] = useState(false);
  const [eventos, setEventos] = useState<Set<string>>(() => new Set(webhook?.eventos ?? []));
  const [cursosIds, setCursosIds] = useState<Set<string>>(() => new Set(webhook?.cursos_ids ?? []));
  const [buscaCurso, setBuscaCurso] = useState("");
  const [ativo, setAtivo] = useState(webhook?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const cursosFiltrados = useMemo(() => {
    const termo = buscaCurso.trim().toLowerCase();
    return termo ? cursos.filter((curso) => curso.nome.toLowerCase().includes(termo)) : cursos;
  }, [cursos, buscaCurso]);

  function alternar(conjunto: Set<string>, definir: (novo: Set<string>) => void, valor: string) {
    const novo = new Set(conjunto);
    if (novo.has(valor)) novo.delete(valor);
    else novo.add(valor);
    definir(novo);
  }

  function handleSalvar() {
    setErro(null);
    const dados: DadosWebhookForm = {
      nome,
      url,
      bearerToken,
      removerToken,
      eventos: [...eventos],
      cursosIds: [...cursosIds],
      ativo,
    };
    startSalvar(async () => {
      const resultado = await salvarWebhook(webhook?.id ?? null, dados);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{webhook ? "Editar webhook" : "Novo webhook"}</DialogTitle>
          <DialogDescription>
            O sistema envia um POST em JSON para a URL sempre que um dos eventos escolhidos acontecer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wh-nome">Nome</Label>
            <Input id="wh-nome" value={nome} maxLength={100} placeholder="Ex.: CRM externo" onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wh-url">URL</Label>
            <Input
              id="wh-url"
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://exemplo.com/webhook"
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wh-token">Bearer Token (opcional)</Label>
            <Input
              id="wh-token"
              type="password"
              autoComplete="off"
              value={bearerToken}
              disabled={removerToken}
              placeholder={webhook?.temToken ? "•••••••• salvo — deixe em branco para manter" : "Enviado em Authorization: Bearer ..."}
              onChange={(e) => setBearerToken(e.target.value)}
            />
            {webhook?.temToken && (
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <Checkbox checked={removerToken} onCheckedChange={(marcado) => setRemoverToken(marcado === true)} />
                Remover o token salvo
              </label>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Eventos</legend>
            {WEBHOOK_EVENTOS.map((evento: WebhookEvento) => (
              <label key={evento} className="flex items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={eventos.has(evento)}
                  onCheckedChange={() => alternar(eventos, setEventos, evento)}
                />
                <span className="flex flex-col">
                  <span>{WEBHOOK_EVENTO_LABELS[evento]}</span>
                  <span className="text-muted-foreground text-xs">{WEBHOOK_EVENTO_DESCRICOES[evento]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Cursos (opcional)</Label>
              <span className="text-muted-foreground text-xs">
                {cursosIds.size === 0 ? "Todos os cursos" : `${cursosIds.size} selecionado(s)`}
              </span>
            </div>
            <Input placeholder="Buscar curso..." value={buscaCurso} onChange={(e) => setBuscaCurso(e.target.value)} />
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border p-2">
              {cursos.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhum curso cadastrado.</p>
              ) : cursosFiltrados.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhum curso encontrado.</p>
              ) : (
                cursosFiltrados.map((curso) => (
                  <label key={curso.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={cursosIds.has(curso.id)} onCheckedChange={() => alternar(cursosIds, setCursosIds, curso.id)} />
                    {curso.nome}
                  </label>
                ))
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Sem nenhum curso marcado, o webhook recebe os eventos de todos. Com cursos marcados, recebe só os eventos desses
              cursos (eventos sem curso, como agendamentos, não são enviados).
            </p>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Ativo</span>
              <span className="text-muted-foreground text-xs">Desligado, o webhook não recebe nenhum evento.</span>
            </span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>

          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
