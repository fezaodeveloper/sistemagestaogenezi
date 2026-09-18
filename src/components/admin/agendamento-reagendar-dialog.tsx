"use client";

// "use client": estado do dialog (data escolhida, horários carregados sob
// demanda via Server Action) e handlers de clique.

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import {
  getHorariosDisponiveisReagendamento,
  reagendarAgendamento,
  type HorarioReagendamento,
} from "@/app/admin/comercial/agendamentos/actions";
import type { Agendamento } from "@/lib/agendamentos/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AgendamentoReagendarDialog({
  agendamento,
  onReagendado,
}: {
  agendamento: Agendamento;
  onReagendado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<HorarioReagendamento[] | null>(null);
  const [horario, setHorario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, startCarregar] = useTransition();
  const [salvando, startSalvar] = useTransition();

  function handleOpenChange(aberto: boolean) {
    setOpen(aberto);
    if (!aberto) {
      setData("");
      setHorarios(null);
      setHorario("");
      setErro(null);
    }
  }

  function handleDataChange(valor: string) {
    setData(valor);
    setHorario("");
    setErro(null);
    setHorarios(null);
    if (!valor) return;

    startCarregar(async () => {
      setHorarios(await getHorariosDisponiveisReagendamento(agendamento.pagina_id, valor));
    });
  }

  function handleConfirmar() {
    if (!data || !horario) return;
    setErro(null);
    startSalvar(async () => {
      const resultado = await reagendarAgendamento(agendamento.id, data, horario);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      handleOpenChange(false);
      onReagendado();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarClock className="size-3.5" />
        Reagendar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar {agendamento.nome}</DialogTitle>
            <DialogDescription>
              Escolha uma nova data e um dos horários disponíveis. O agendamento volta para a coluna
              &quot;Agendado&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reagendar-data-${agendamento.id}`}>Nova data</Label>
              <Input
                id={`reagendar-data-${agendamento.id}`}
                type="date"
                min={hojeISO()}
                value={data}
                onChange={(event) => handleDataChange(event.target.value)}
              />
            </div>

            {carregando && <p className="text-muted-foreground text-sm">Buscando horários...</p>}

            {!carregando && data && horarios !== null && horarios.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nenhum horário disponível nessa data. Tente outro dia.
              </p>
            )}

            {!carregando && horarios !== null && horarios.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Horário</Label>
                <div className="flex flex-wrap gap-2">
                  {horarios.map((item) => (
                    <Button
                      key={item.horario}
                      type="button"
                      size="sm"
                      variant={horario === item.horario ? "default" : "outline"}
                      disabled={item.vagasRestantes === 0}
                      onClick={() => setHorario(item.horario)}
                      title={item.vagasRestantes === 0 ? "Lotado" : `${item.vagasRestantes} vaga(s)`}
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
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmar} disabled={!data || !horario || salvando}>
              {salvando ? "Salvando..." : "Confirmar reagendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
