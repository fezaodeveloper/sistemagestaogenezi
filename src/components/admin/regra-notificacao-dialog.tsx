"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { criarRegra, atualizarRegra } from "@/app/admin/configuracoes/regras-notificacao-actions";
import {
  DIA_SEMANA_LABELS_REGRA,
  REGRA_NOTIFICACAO_DESTINO_LABELS,
  REGRA_NOTIFICACAO_DESTINOS,
  REGRA_NOTIFICACAO_RECORRENCIA_LABELS,
  REGRA_NOTIFICACAO_RECORRENCIAS,
  REGRA_NOTIFICACAO_TIPO_LABELS,
  REGRA_NOTIFICACAO_TIPOS,
  type RegraNotificacao,
  type RegraNotificacaoDestino,
  type RegraNotificacaoRecorrencia,
  type RegraNotificacaoTipo,
} from "@/lib/regras-notificacao/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DIA_SEMANA_ITEMS = Object.fromEntries(DIA_SEMANA_LABELS_REGRA.map((label, indice) => [String(indice), label]));

function valoresIniciais(regra?: RegraNotificacao) {
  return {
    nome: regra?.nome ?? "",
    tipo: regra?.tipo ?? ("lembrete_aula" as RegraNotificacaoTipo),
    destino: regra?.destino ?? ("whatsapp" as RegraNotificacaoDestino),
    recorrencia: regra?.recorrencia ?? ("diario" as RegraNotificacaoRecorrencia),
    diaSemana: regra?.dia_semana ?? 1,
    horaEnvio: regra?.hora_envio ?? 8,
    mensagemTemplate: regra?.mensagem_template ?? "",
    proximaExecucao: regra?.proxima_execucao ?? new Date().toISOString().slice(0, 10),
  };
}

export function RegraNotificacaoDialog({ regra, onSalvo }: { regra?: RegraNotificacao; onSalvo?: () => void }) {
  const [open, setOpen] = useState(false);
  const [valores, setValores] = useState(valoresIniciais(regra));
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setValores(valoresIniciais(regra));
      setErro(null);
    }
  }

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const dados = {
        nome: valores.nome,
        tipo: valores.tipo,
        destino: valores.destino,
        recorrencia: valores.recorrencia,
        dia_semana: valores.recorrencia === "semanal" ? valores.diaSemana : null,
        hora_envio: valores.horaEnvio,
        mensagem_template: valores.mensagemTemplate || undefined,
        proxima_execucao: valores.proximaExecucao,
      };
      const resultado = regra ? await atualizarRegra(regra.id, dados) : await criarRegra(dados);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          regra ? (
            <Button type="button" variant="ghost" size="sm">
              Editar
            </Button>
          ) : (
            <Button type="button">
              <Plus />
              Nova Regra
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{regra ? "Editar regra" : "Nova regra de notificação"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="regra-nome">Nome da regra</Label>
            <Input
              id="regra-nome"
              placeholder="Ex.: Lembrete semanal de pagamento"
              value={valores.nome}
              onChange={(e) => setValores((v) => ({ ...v, nome: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="regra-tipo">Tipo</Label>
              <Select
                items={REGRA_NOTIFICACAO_TIPO_LABELS}
                value={valores.tipo}
                onValueChange={(value) => setValores((v) => ({ ...v, tipo: value as RegraNotificacaoTipo }))}
              >
                <SelectTrigger id="regra-tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGRA_NOTIFICACAO_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {REGRA_NOTIFICACAO_TIPO_LABELS[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="regra-destino">Destino</Label>
              <Select
                items={REGRA_NOTIFICACAO_DESTINO_LABELS}
                value={valores.destino}
                onValueChange={(value) => setValores((v) => ({ ...v, destino: value as RegraNotificacaoDestino }))}
              >
                <SelectTrigger id="regra-destino" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGRA_NOTIFICACAO_DESTINOS.map((destino) => (
                    <SelectItem key={destino} value={destino}>
                      {REGRA_NOTIFICACAO_DESTINO_LABELS[destino]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="regra-recorrencia">Recorrência</Label>
              <Select
                items={REGRA_NOTIFICACAO_RECORRENCIA_LABELS}
                value={valores.recorrencia}
                onValueChange={(value) =>
                  setValores((v) => ({ ...v, recorrencia: value as RegraNotificacaoRecorrencia }))
                }
              >
                <SelectTrigger id="regra-recorrencia" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGRA_NOTIFICACAO_RECORRENCIAS.map((recorrencia) => (
                    <SelectItem key={recorrencia} value={recorrencia}>
                      {REGRA_NOTIFICACAO_RECORRENCIA_LABELS[recorrencia]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {valores.recorrencia === "semanal" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="regra-dia-semana">Dia da semana</Label>
                <Select
                  items={DIA_SEMANA_ITEMS}
                  value={String(valores.diaSemana)}
                  onValueChange={(value) => setValores((v) => ({ ...v, diaSemana: Number(value) }))}
                >
                  <SelectTrigger id="regra-dia-semana" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIA_SEMANA_LABELS_REGRA.map((label, indice) => (
                      <SelectItem key={indice} value={String(indice)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="regra-hora-envio">Hora de envio</Label>
              <Input
                id="regra-hora-envio"
                type="number"
                min={0}
                max={23}
                value={valores.horaEnvio}
                onChange={(e) => setValores((v) => ({ ...v, horaEnvio: Number(e.target.value) }))}
              />
              <p className="text-muted-foreground text-xs">Informativo — plano Hobby roda sempre às 8h.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="regra-proxima-execucao">Próxima execução</Label>
              <Input
                id="regra-proxima-execucao"
                type="date"
                value={valores.proximaExecucao}
                onChange={(e) => setValores((v) => ({ ...v, proximaExecucao: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="regra-template">Template da mensagem</Label>
            <Textarea
              id="regra-template"
              rows={4}
              placeholder="Usado em WhatsApp/Telegram Personalizado"
              value={valores.mensagemTemplate}
              onChange={(e) => setValores((v) => ({ ...v, mensagemTemplate: e.target.value }))}
            />
          </div>

          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={isPending || !valores.nome.trim()} onClick={handleSalvar}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
