"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  atualizarLeadCrm,
  buscarAgendamentosLead,
  buscarHistoricoLead,
  matricularLead,
  moverLeadKanban,
  registrarAnotacaoLead,
  registrarFollowup,
  type CursoBusca,
} from "@/app/admin/leads/actions";
import { AGENDAMENTO_STATUS_BADGE_CLASS, AGENDAMENTO_STATUS_LABELS, type Agendamento } from "@/lib/agendamentos/schema";
import {
  colunaExigeMotivoPerda,
  dataHoraLeadParaInput,
  dataLeadParaInput,
  diasNoFunil,
  extrairHistoricoFollowups,
  formatarDataLead,
  formatarDataHoraCompletaLead,
  formatarTempoRelativoLead,
  kanbanColunaEstilo,
  LEAD_HISTORICO_ICONES,
  LEAD_ORIGEM_BADGE_CLASS,
  LEAD_ORIGEM_LABELS,
  TEMPERATURAS,
  TEMPERATURA_LABELS,
  type KanbanColunaConfig,
  type LeadHistoricoEntrada,
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
  return lead.curso_id && lead.nomeCurso ? { id: lead.curso_id, nome: lead.nomeCurso } : null;
}

export function LeadDetalhesDrawer({
  lead,
  colunas,
  campanhasMarketing,
  responsaveis,
  open,
  onOpenChange,
  onMudou,
}: {
  lead: LeadComCurso;
  colunas: KanbanColunaConfig[];
  campanhasMarketing: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMudou: () => void;
}) {
  const [temperatura, setTemperatura] = useState<Temperatura>(lead.temperatura ?? "morno");
  const [proximaAcao, setProximaAcao] = useState(lead.proxima_acao ?? "");
  const [ultimoContato, setUltimoContato] = useState(dataLeadParaInput(lead.ultimo_followup));
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [curso, setCurso] = useState<CursoBusca | null>(cursoDoLead(lead));
  // Muda a cada reidratação — o combobox guarda o texto digitado em estado
  // próprio, então precisa remontar pra refletir o curso do lead atual.
  const [versaoCombobox, setVersaoCombobox] = useState(0);
  const [novaNotaFollowup, setNovaNotaFollowup] = useState("");

  // CRM 2.1 (TAREFA) — campos novos.
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [campanhaId, setCampanhaId] = useState(lead.campanha_id ?? "");
  const [responsavelId, setResponsavelId] = useState(lead.responsavel_id ?? "");
  const [proximoContato, setProximoContato] = useState(dataHoraLeadParaInput(lead.proximo_contato));
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? "");

  // "✏️ Anotar" (TAREFA) — anotação rápida, grava em lead_historico (tipo='anotacao'),
  // separada das notas/histórico de follow-ups acima (que continuam existindo como estavam).
  const [anotando, setAnotando] = useState(false);
  const [textoAnotacao, setTextoAnotacao] = useState("");

  // Histórico de atividades (tabela lead_historico) — buscado sob demanda ao abrir o drawer.
  const [historico, setHistorico] = useState<LeadHistoricoEntrada[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // Agendamentos do lead (TAREFA CRM 2.2 PARTE 5) — buscado sob demanda, mesmo motivo do
  // histórico acima.
  const [agendamentos, setAgendamentos] = useState<Pick<Agendamento, "id" | "data_agendada" | "horario" | "status">[]>(
    [],
  );
  const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(false);

  // "Mover coluna" pra uma coluna "Perdido" exige motivo — intercepta antes de mover de verdade.
  const [colunaPendente, setColunaPendente] = useState<string | null>(null);
  const [motivoPerdaTexto, setMotivoPerdaTexto] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPendingFollowup, startTransitionFollowup] = useTransition();
  const [isPendingColuna, startTransitionColuna] = useTransition();
  const [isPendingAnotacao, startTransitionAnotacao] = useTransition();

  function recarregarHistorico() {
    setCarregandoHistorico(true);
    buscarHistoricoLead(lead.id)
      .then(setHistorico)
      .finally(() => setCarregandoHistorico(false));
  }

  function recarregarAgendamentos() {
    setCarregandoAgendamentos(true);
    buscarAgendamentosLead(lead.id)
      .then(setAgendamentos)
      .finally(() => setCarregandoAgendamentos(false));
  }

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
      setCurso(cursoDoLead(lead));
      setVersaoCombobox((v) => v + 1);
      setNovaNotaFollowup("");
      setWhatsapp(lead.whatsapp ?? "");
      setEmail(lead.email ?? "");
      setCampanhaId(lead.campanha_id ?? "");
      setResponsavelId(lead.responsavel_id ?? "");
      setProximoContato(dataHoraLeadParaInput(lead.proximo_contato));
      setObservacoes(lead.observacoes ?? "");
      setAnotando(false);
      setTextoAnotacao("");
      setColunaPendente(null);
      setMotivoPerdaTexto("");
      setError(null);
      setSalvo(false);
      recarregarHistorico();
      recarregarAgendamentos();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarregarHistorico/recarregarAgendamentos dependem só de lead.id, incluído abaixo
  }, [open, lead]);

  const historicoFollowups = extrairHistoricoFollowups(lead.notas);
  const colunaItems = Object.fromEntries(colunas.map((c) => [c.id, c.nome]));
  const campanhaItems = Object.fromEntries(campanhasMarketing.map((c) => [c.id, c.nome]));
  const responsavelItems = Object.fromEntries(responsaveis.map((r) => [r.id, r.nome]));
  const colunaAtual = colunas.find((c) => c.id === lead.kanban_coluna);
  const whatsappExibido = lead.whatsapp || lead.telefone;

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
        campanha_origem: lead.campanha_origem ?? "",
        curso_id: cursoAlterado,
        ultimo_contato: ultimoContatoAlterado,
        whatsapp,
        email,
        campanha_id: campanhaId,
        responsavel_id: responsavelId,
        proximo_contato: proximoContato,
        observacoes,
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
    if (!coluna || coluna === lead.kanban_coluna) return;
    const destino = colunas.find((c) => c.id === coluna);

    if (destino && colunaExigeMotivoPerda(destino.nome) && !lead.motivo_perda) {
      setColunaPendente(coluna);
      setMotivoPerdaTexto("");
      return;
    }

    startTransitionColuna(async () => {
      await moverLeadKanban(lead.id, coluna);
      onMudou();
    });
  }

  function confirmarMoverComMotivo() {
    if (!colunaPendente || !motivoPerdaTexto.trim()) return;
    startTransitionColuna(async () => {
      await moverLeadKanban(lead.id, colunaPendente, motivoPerdaTexto.trim());
      setColunaPendente(null);
      onMudou();
    });
  }

  function handleMatricular() {
    startTransitionColuna(async () => {
      await matricularLead(lead.id);
      onMudou();
      recarregarHistorico();
    });
  }

  function handleSalvarAnotacao() {
    if (!textoAnotacao.trim()) return;
    startTransitionAnotacao(async () => {
      const resultado = await registrarAnotacaoLead(lead.id, textoAnotacao);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setTextoAnotacao("");
      setAnotando(false);
      recarregarHistorico();
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
          <SheetTitle className="text-xl">{lead.nome}</SheetTitle>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {colunaAtual && (
              <Badge style={kanbanColunaEstilo(colunaAtual.cor)} className="border-0">
                {colunaAtual.nome}
              </Badge>
            )}
            <Badge className={LEAD_ORIGEM_BADGE_CLASS[lead.origem]}>{LEAD_ORIGEM_LABELS[lead.origem]}</Badge>
            <span className="text-muted-foreground text-xs">
              Há {diasNoFunil(lead.created_at)} dia{diasNoFunil(lead.created_at) === 1 ? "" : "s"} no funil
            </span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* Botões rápidos (TAREFA) */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-green-600 dark:text-green-400"
              nativeButton={false}
              render={<a href={`https://wa.me/55${whatsappExibido.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" />}
            >
              💬 WhatsApp
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAnotando((atual) => !atual)}>
              ✏️ Anotar
            </Button>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/admin/comercial/agendamentos?lead_id=${lead.id}`} />}
            >
              📅 Agendar
            </Button>
            {lead.kanban_coluna !== "matriculado" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-green-600 dark:text-green-400"
                disabled={isPendingColuna}
                onClick={handleMatricular}
              >
                🎓 Matricular
              </Button>
            )}
          </div>

          {anotando && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Label htmlFor="anotacao-rapida">Nova anotação</Label>
              <Textarea
                id="anotacao-rapida"
                autoFocus
                rows={3}
                value={textoAnotacao}
                onChange={(event) => setTextoAnotacao(event.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPendingAnotacao || !textoAnotacao.trim()}
                  onClick={handleSalvarAnotacao}
                >
                  {isPendingAnotacao ? "Salvando..." : "Salvar"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAnotando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>📱 {whatsappExibido}</span>
              <CopiarWhatsappButton telefone={whatsappExibido} comTexto />
            </div>
            <p className="text-muted-foreground">Cadastrado em {formatarDataHoraCompletaLead(lead.created_at)}</p>
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Dados</h3>

            <div className="flex flex-col gap-2">
              <Label htmlFor="curso-interesse">Curso de interesse</Label>
              <CursoCombobox
                key={`${lead.id}-${versaoCombobox}`}
                id="curso-interesse"
                selecionado={curso}
                onSelecionar={setCurso}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="drawer-whatsapp">WhatsApp</Label>
                <Input id="drawer-whatsapp" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="drawer-email">E-mail</Label>
                <Input
                  id="drawer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="drawer-campanha">Campanha</Label>
              <Select
                items={campanhaItems}
                value={campanhaId}
                onValueChange={(valor) => setCampanhaId(valor ?? "")}
              >
                <SelectTrigger id="drawer-campanha" className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {campanhasMarketing.map((campanha) => (
                    <SelectItem key={campanha.id} value={campanha.id}>
                      {campanha.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!campanhaId && lead.campanha_origem && (
                <p className="text-muted-foreground text-xs italic">
                  Campanha de origem (cadastro antigo): {lead.campanha_origem}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="drawer-responsavel">Responsável</Label>
              <Select
                items={responsavelItems}
                value={responsavelId}
                onValueChange={(valor) => setResponsavelId(valor ?? "")}
              >
                <SelectTrigger id="drawer-responsavel" className="w-full">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis.map((responsavel) => (
                    <SelectItem key={responsavel.id} value={responsavel.id}>
                      {responsavel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="drawer-proximo-contato">Próximo contato</Label>
              <Input
                id="drawer-proximo-contato"
                type="datetime-local"
                value={proximoContato}
                onChange={(event) => setProximoContato(event.target.value)}
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
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
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

            {colunaPendente && (
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <Label htmlFor="motivo-perda-drawer">Motivo da perda</Label>
                <Textarea
                  id="motivo-perda-drawer"
                  autoFocus
                  rows={2}
                  value={motivoPerdaTexto}
                  onChange={(event) => setMotivoPerdaTexto(event.target.value)}
                  placeholder="Obrigatório para mover pra esta coluna"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPendingColuna || !motivoPerdaTexto.trim()}
                    onClick={confirmarMoverComMotivo}
                  >
                    {isPendingColuna ? "Movendo..." : "Confirmar"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setColunaPendente(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label>Histórico de follow-ups</Label>
            {historicoFollowups.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum follow-up registrado ainda.</p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                {historicoFollowups.map((linha, indice) => (
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

          <Separator />

          {/* Histórico de atividades (tabela lead_historico, TAREFA CRM 2.1) — timeline vertical,
              diferente do "Histórico de follow-ups" acima (que é texto livre em `notas`). */}
          <div className="flex flex-col gap-2">
            <Label>Histórico de atividades</Label>
            {carregandoHistorico ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : historico.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {historico.map((entrada) => (
                  <li key={entrada.id} className="flex gap-2 text-sm">
                    <span>{LEAD_HISTORICO_ICONES[entrada.tipo]}</span>
                    <div className="flex flex-col gap-0.5">
                      <p>{entrada.descricao}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatarTempoRelativoLead(entrada.createdAt)}
                        {entrada.usuarioNome ? ` · ${entrada.usuarioNome}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <Separator />

          {/* Agendamentos do lead (TAREFA CRM 2.2 PARTE 5). */}
          <div className="flex flex-col gap-2">
            <Label>Agendamentos</Label>
            {carregandoAgendamentos ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : agendamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum agendamento ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {agendamentos.map((agendamento) => (
                  <li key={agendamento.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {formatarDataLead(agendamento.data_agendada)} às {agendamento.horario}
                    </span>
                    <Badge className={AGENDAMENTO_STATUS_BADGE_CLASS[agendamento.status]}>
                      {AGENDAMENTO_STATUS_LABELS[agendamento.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="w-fit"
              nativeButton={false}
              render={<Link href={`/admin/comercial/agendamentos?lead_id=${lead.id}`} />}
            >
              Ver todos →
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
