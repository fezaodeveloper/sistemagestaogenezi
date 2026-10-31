"use client";

// "use client": estado do fluxo de cancelar/remarcar (dialogs, horários carregados sob
// demanda via Server Action).

import { useState, useTransition } from "react";
import {
  cancelarAgendamentoCliente,
  getHorariosParaRemarcacaoPublica,
  remarcarAgendamentoCliente,
  type HorarioRemarcacao,
} from "@/app/agendar/[slug]/meu-agendamento/[agendamentoId]/actions";
import type { Agendamento, AgendamentoPagina } from "@/lib/agendamentos/schema";
import { dataComDiaSemana } from "@/lib/datas/util";
import { CAMPO_PUBLICO_ADAPTATIVO } from "@/lib/cores/campo-publico";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MeuAgendamentoView({ agendamento, pagina }: { agendamento: Agendamento; pagina: AgendamentoPagina }) {
  const [status, setStatus] = useState(agendamento.status);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, startCancelar] = useTransition();

  const [remarcando, setRemarcando] = useState(false);
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<HorarioRemarcacao[] | null>(null);
  const [horario, setHorario] = useState("");
  const [carregandoHorarios, startCarregar] = useTransition();
  const [salvandoRemarcacao, startSalvar] = useTransition();
  const [remarcado, setRemarcado] = useState<{ data: string; horario: string } | null>(null);

  function confirmarCancelamento() {
    setErro(null);
    startCancelar(async () => {
      const resultado = await cancelarAgendamentoCliente(agendamento.id, pagina.slug, motivo);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      setStatus("cancelado");
    });
  }

  function handleDataChange(valor: string) {
    setData(valor);
    setHorario("");
    setErro(null);
    setHorarios(null);
    if (!valor) return;
    startCarregar(async () => {
      setHorarios(await getHorariosParaRemarcacaoPublica(agendamento.id, pagina.slug, valor));
    });
  }

  function confirmarRemarcacao() {
    if (!data || !horario) return;
    setErro(null);
    startSalvar(async () => {
      const resultado = await remarcarAgendamentoCliente(agendamento.id, pagina.slug, data, horario);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setStatus("cancelado");
      setRemarcado({ data, horario });
      setRemarcando(false);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium">📋 {pagina.titulo}</p>
          <p className="text-muted-foreground text-sm">👤 {agendamento.nome}</p>
        </div>

        <div className="bg-muted/50 flex flex-col gap-1.5 rounded-md p-4 text-sm">
          <p>📅 {dataComDiaSemana(agendamento.data_agendada)}</p>
          <p>⏰ {agendamento.horario}</p>
          {pagina.local_atendimento && <p>📍 {pagina.local_atendimento}</p>}
        </div>

        {status === "confirmado" && !remarcado && (
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" variant="outline" className="flex-1" />}>
                ❌ Cancelar
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
                  <AlertDialogDescription>Tem certeza que deseja cancelar? Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-1.5">
                  <Label className="font-semibold" htmlFor="motivo">Motivo (opcional)</Label>
                  <Textarea id="motivo" rows={2} value={motivo} onChange={(event) => setMotivo(event.target.value)} className={CAMPO_PUBLICO_ADAPTATIVO} />
                </div>
                {erro && (
                  <p role="alert" className="text-destructive text-sm">
                    {erro}
                  </p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={cancelando} onClick={confirmarCancelamento}>
                    {cancelando ? "Cancelando..." : "Cancelar agendamento"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={remarcando} onOpenChange={setRemarcando}>
              <DialogTrigger render={<Button type="button" className="flex-1" />}>🔄 Remarcar</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remarcar agendamento</DialogTitle>
                  <DialogDescription>Escolha uma nova data e um dos horários disponíveis.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="font-semibold" htmlFor="nova-data">Nova data</Label>
                    <Input
                      id="nova-data"
                      type="date"
                      min={hojeISO()}
                      value={data}
                      onChange={(event) => handleDataChange(event.target.value)}
                      className={CAMPO_PUBLICO_ADAPTATIVO}
                    />
                  </div>
                  {carregandoHorarios && <p className="text-muted-foreground text-sm">Buscando horários...</p>}
                  {!carregandoHorarios && data && horarios !== null && horarios.length === 0 && (
                    <p className="text-muted-foreground text-sm">Nenhum horário disponível nessa data. Tente outro dia.</p>
                  )}
                  {!carregandoHorarios && horarios !== null && horarios.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="font-semibold">Horário</Label>
                      <div className="flex flex-wrap gap-2">
                        {horarios.map((item) => (
                          <Button
                            key={item.horario}
                            type="button"
                            size="sm"
                            variant={horario === item.horario ? "default" : "outline"}
                            disabled={item.vagasRestantes === 0}
                            onClick={() => setHorario(item.horario)}
                          >
                            {item.horario}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {erro && (
                    <p role="alert" className="text-destructive text-sm">
                      {erro}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRemarcando(false)} disabled={salvandoRemarcacao}>
                    Voltar
                  </Button>
                  <Button type="button" onClick={confirmarRemarcacao} disabled={!data || !horario || salvandoRemarcacao}>
                    {salvandoRemarcacao ? "Salvando..." : "Confirmar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {remarcado && (
          <p className="rounded-md bg-green-500/10 p-3 text-center text-sm text-green-600 dark:text-green-400">
            ✅ Remarcado para {dataComDiaSemana(remarcado.data)} às {remarcado.horario}.
          </p>
        )}

        {status === "cancelado" && !remarcado && (
          <p className="text-muted-foreground text-center text-sm">Este agendamento foi cancelado.</p>
        )}
        {status === "realizado" && <p className="text-muted-foreground text-center text-sm">Este agendamento já foi realizado.</p>}
        {status === "faltou" && (
          <p className="text-muted-foreground text-center text-sm">
            Consta que você não compareceu a este agendamento. Qualquer dúvida, entre em contato com a secretaria.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
