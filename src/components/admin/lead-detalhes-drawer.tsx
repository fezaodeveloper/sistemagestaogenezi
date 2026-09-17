"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { atualizarLeadCrm, moverLeadKanban, registrarFollowup } from "@/app/admin/leads/actions";
import {
  KANBAN_COLUNAS,
  KANBAN_COLUNA_LABELS,
  LEAD_ORIGEM_LABELS,
  TEMPERATURAS,
  TEMPERATURA_LABELS,
  type KanbanColuna,
  type Temperatura,
} from "@/lib/leads/schema";
import type { LeadComCurso } from "@/lib/leads/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// "Histórico de follow-ups" não tem tabela própria (a migration só adicionou
// um campo `notas` de texto livre em leads) — cada follow-up automático
// (cron) ou manual (botão abaixo) vira uma linha "[data hora] texto" no
// topo de notas, mais recente primeiro. O textarea "Notas" edita o campo
// inteiro; "Registrar follow-up" só acrescenta uma entrada nova sem
// precisar reabrir o textarea.
function extrairHistorico(notas: string | null): string[] {
  if (!notas) return [];
  return notas.split("\n").filter((linha) => /^\[\d{2}\/\d{2}\/\d{4}/.test(linha));
}

export function LeadDetalhesDrawer({
  lead,
  open,
  onOpenChange,
  onMudou,
}: {
  lead: LeadComCurso;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMudou: () => void;
}) {
  const [temperatura, setTemperatura] = useState<Temperatura>(lead.temperatura ?? "morno");
  const [proximaAcao, setProximaAcao] = useState(lead.proxima_acao ?? "");
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [campanhaOrigem, setCampanhaOrigem] = useState(lead.campanha_origem ?? "");
  const [novaNotaFollowup, setNovaNotaFollowup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPendingFollowup, startTransitionFollowup] = useTransition();
  const [isPendingColuna, startTransitionColuna] = useTransition();

  // Reidrata os campos quando o drawer reabre pra um lead diferente (ou o
  // mesmo lead com dado atualizado por router.refresh() do pai).
  useEffect(() => {
    if (!open) return;
    // queueMicrotask evita setState síncrono direto no corpo do efeito
    // (react-hooks/set-state-in-effect) — precisa resincronizar os campos
    // com `lead` sempre que o drawer reabre ou o pai faz router.refresh().
    queueMicrotask(() => {
      setTemperatura(lead.temperatura ?? "morno");
      setProximaAcao(lead.proxima_acao ?? "");
      setNotas(lead.notas ?? "");
      setCampanhaOrigem(lead.campanha_origem ?? "");
      setNovaNotaFollowup("");
      setError(null);
      setSalvo(false);
    });
  }, [open, lead]);

  const whatsappDigitos = lead.telefone.replace(/\D/g, "");
  const historico = extrairHistorico(lead.notas);

  function handleSalvar() {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await atualizarLeadCrm(lead.id, {
        temperatura,
        proxima_acao: proximaAcao,
        notas,
        campanha_origem: campanhaOrigem,
      });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
      onMudou();
    });
  }

  function handleMoverColuna(coluna: string | null) {
    if (!coluna) return;
    startTransitionColuna(async () => {
      await moverLeadKanban(lead.id, coluna);
      onMudou();
    });
  }

  function handleMatricular() {
    startTransitionColuna(async () => {
      await moverLeadKanban(lead.id, "matriculado" satisfies KanbanColuna);
      onMudou();
    });
  }

  function handleRegistrarFollowup() {
    if (!novaNotaFollowup.trim()) return;
    setError(null);
    startTransitionFollowup(async () => {
      const resultado = await registrarFollowup(lead.id, novaNotaFollowup);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setNovaNotaFollowup("");
      onMudou();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{lead.nome}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-1 text-sm">
            <a
              href={`https://wa.me/55${whatsappDigitos}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground w-fit hover:underline"
            >
              📱 {lead.telefone}
            </a>
            <p>
              📚 Curso de interesse: <span className="font-medium">{lead.nomeCurso ?? "—"}</span>
            </p>
            <p className="text-muted-foreground">
              Origem: {LEAD_ORIGEM_LABELS[lead.origem]}
              {lead.campanha_origem ? ` · ${lead.campanha_origem}` : ""}
            </p>
            {/* leads não tem email/cidade no schema atual (só nome, telefone,
                curso_id, origem) — sinalizado ao admin em vez de omitir em
                silêncio, ver conversa sobre esta migration. */}
            <p className="text-muted-foreground text-xs italic">
              Email e cidade ainda não existem no cadastro de leads.
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="temperatura">Temperatura</Label>
            <Select
              items={TEMPERATURA_LABELS}
              value={temperatura}
              onValueChange={(value) => setTemperatura(value as Temperatura)}
            >
              <SelectTrigger id="temperatura" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPERATURAS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TEMPERATURA_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="proxima-acao">Próxima ação</Label>
            <Input
              id="proxima-acao"
              type="date"
              value={proximaAcao}
              onChange={(event) => setProximaAcao(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="campanha-origem">Campanha de origem</Label>
            <Input
              id="campanha-origem"
              value={campanhaOrigem}
              onChange={(event) => setCampanhaOrigem(event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" rows={4} value={notas} onChange={(event) => setNotas(event.target.value)} />
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" disabled={isPending} onClick={handleSalvar}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
            {salvo && !error && <span className="text-muted-foreground text-sm">Salvo.</span>}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="mover-coluna">Mover coluna</Label>
            <Select
              items={KANBAN_COLUNA_LABELS}
              value={lead.kanban_coluna}
              onValueChange={handleMoverColuna}
              disabled={isPendingColuna}
            >
              <SelectTrigger id="mover-coluna" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KANBAN_COLUNAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {KANBAN_COLUNA_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lead.kanban_coluna !== "matriculado" && (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={isPendingColuna} onClick={handleMatricular}>
                ✅ Matricular
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/admin/matriculas/nova" />}
              >
                Ir para Nova Matrícula →
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <Label>Histórico de follow-ups</Label>
            {historico.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum follow-up registrado ainda.</p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                {historico.map((linha, indice) => (
                  <p key={indice} className="border-b pb-1 last:border-0">
                    {linha}
                  </p>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={novaNotaFollowup}
                onChange={(event) => setNovaNotaFollowup(event.target.value)}
                placeholder="Registrar novo follow-up..."
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPendingFollowup || !novaNotaFollowup.trim()}
                onClick={handleRegistrarFollowup}
              >
                {isPendingFollowup ? "..." : "Registrar"}
              </Button>
            </div>
            {lead.followup_count > 0 && (
              <Badge variant="outline" className="w-fit">
                {lead.followup_count}/7 follow-ups automáticos
              </Badge>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
