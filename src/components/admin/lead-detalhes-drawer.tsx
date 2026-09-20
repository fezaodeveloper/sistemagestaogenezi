"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { atualizarLeadCrm, moverLeadKanban, registrarFollowup, type CursoBusca } from "@/app/admin/leads/actions";
import {
  LEAD_ORIGEM_LABELS,
  TEMPERATURAS,
  TEMPERATURA_LABELS,
  dataLeadParaInput,
  extrairHistoricoFollowups,
  formatarDataHoraCompletaLead,
  type KanbanColunaConfig,
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
import { CopiarWhatsappButton } from "@/components/admin/copiar-whatsapp-button";
import { CursoCombobox } from "@/components/admin/curso-combobox";

function cursoDoLead(lead: LeadComCurso): CursoBusca | null {
  return lead.nomeCurso ? { id: lead.curso_id, nome: lead.nomeCurso } : null;
}

export function LeadDetalhesDrawer({
  lead,
  colunas,
  open,
  onOpenChange,
  onMudou,
}: {
  lead: LeadComCurso;
  colunas: KanbanColunaConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMudou: () => void;
}) {
  const [temperatura, setTemperatura] = useState<Temperatura>(lead.temperatura ?? "morno");
  const [proximaAcao, setProximaAcao] = useState(lead.proxima_acao ?? "");
  const [ultimoContato, setUltimoContato] = useState(dataLeadParaInput(lead.ultimo_followup));
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [campanhaOrigem, setCampanhaOrigem] = useState(lead.campanha_origem ?? "");
  const [curso, setCurso] = useState<CursoBusca | null>(cursoDoLead(lead));
  // Muda a cada reidratação — o combobox guarda o texto digitado em estado
  // próprio, então precisa remontar pra refletir o curso do lead atual.
  const [versaoCombobox, setVersaoCombobox] = useState(0);
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
      setUltimoContato(dataLeadParaInput(lead.ultimo_followup));
      setNotas(lead.notas ?? "");
      setCampanhaOrigem(lead.campanha_origem ?? "");
      setCurso(cursoDoLead(lead));
      setVersaoCombobox((v) => v + 1);
      setNovaNotaFollowup("");
      setError(null);
      setSalvo(false);
    });
  }, [open, lead]);

  const historico = extrairHistoricoFollowups(lead.notas);
  const colunaItems = Object.fromEntries(colunas.map((c) => [c.id, c.nome]));

  function handleSalvar() {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const cursoAlterado = curso && curso.id !== lead.curso_id ? curso.id : undefined;
      const ultimoContatoAlterado =
        ultimoContato !== dataLeadParaInput(lead.ultimo_followup) ? ultimoContato : undefined;

      const resultado = await atualizarLeadCrm(lead.id, {
        temperatura,
        proxima_acao: proximaAcao,
        notas,
        campanha_origem: campanhaOrigem,
        curso_id: cursoAlterado,
        ultimo_contato: ultimoContatoAlterado,
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
      await moverLeadKanban(lead.id, "matriculado");
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
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>📱 {lead.telefone}</span>
              <CopiarWhatsappButton telefone={lead.telefone} comTexto />
              <Button
                type="button"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Abrir no WhatsApp
              </Button>
            </div>
            <p className="text-muted-foreground">
              Origem: {LEAD_ORIGEM_LABELS[lead.origem]}
              {lead.campanha_origem ? ` · ${lead.campanha_origem}` : ""}
            </p>
            <p className="text-muted-foreground">Cadastrado em {formatarDataHoraCompletaLead(lead.created_at)}</p>
            {/* leads não tem email/cidade no schema atual (só nome, telefone,
                curso_id, origem) — sinalizado ao admin em vez de omitir em
                silêncio, ver conversa sobre esta migration. */}
            <p className="text-muted-foreground text-xs italic">
              Email e cidade ainda não existem no cadastro de leads.
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="curso-interesse">Curso de interesse</Label>
            <CursoCombobox
              key={`${lead.id}-${versaoCombobox}`}
              id="curso-interesse"
              selecionado={curso}
              onSelecionar={setCurso}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ultimo-contato">Último contato</Label>
              <Input
                id="ultimo-contato"
                type="date"
                value={ultimoContato}
                onChange={(event) => setUltimoContato(event.target.value)}
              />
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
              items={colunaItems}
              value={lead.kanban_coluna}
              onValueChange={handleMoverColuna}
              disabled={isPendingColuna}
            >
              <SelectTrigger id="mover-coluna" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colunas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
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
