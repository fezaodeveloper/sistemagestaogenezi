"use client";

import { useActionState, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { salvarWhatsappNotificacoes, type WhatsappNotificacoesFormState } from "@/app/admin/configuracoes/actions";
import { testarWhatsappNotificacaoAction } from "@/app/admin/configuracoes/notificacoes/actions";
import type { WhatsappNotifConfig } from "@/lib/configuracoes/schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Padrão idêntico ao TelegramNotificacoesForm — useActionState + botão Salvar
// (não auto-save, pois sonner não está instalado no projeto).

type Props = { defaultValues: WhatsappNotifConfig };

type Categoria = {
  titulo: string;
  emoji: string;
  itens: Array<{
    chave: keyof WhatsappNotifConfig;
    label: string;
    descricao: string;
  }>;
};

const CATEGORIAS: Categoria[] = [
  {
    titulo: "Alunos / LMS",
    emoji: "🎓",
    itens: [
      {
        chave: "wz_matricula_criada",
        label: "Matrícula criada",
        descricao: "Mensagem ao aluno ao confirmar a matrícula.",
      },
      {
        chave: "wz_lembrete_aula",
        label: "Lembrete de aula",
        descricao: "Aviso automático 1 dia antes da aula (cron diário).",
      },
      {
        chave: "wz_falta_aula",
        label: "Falta em aula",
        descricao: "Notificação ao aluno ao registrar falta.",
      },
      {
        chave: "wz_dados_acesso",
        label: "Dados de acesso (botão manual)",
        descricao: 'Envio manual pelo admin — botão "📱 Dados de acesso" na matrícula.',
      },
    ],
  },
  {
    titulo: "Financeiro",
    emoji: "💰",
    itens: [
      {
        chave: "wz_cobranca_gerada",
        label: "Cobrança gerada",
        descricao: "Mensagem ao aluno ao gerar cobrança no Asaas.",
      },
      {
        chave: "wz_cobranca_atrasada_d1",
        label: "Cobrança atrasada — 1 a 2 dias",
        descricao: "Lembrete automático no 1º dia de atraso (cron diário).",
      },
      {
        chave: "wz_cobranca_atrasada_d3",
        label: "Cobrança atrasada — 3 a 6 dias",
        descricao: "Lembrete automático no 3º dia de atraso (cron diário).",
      },
      {
        chave: "wz_cobranca_atrasada_d7",
        label: "Cobrança atrasada — 7 a 14 dias",
        descricao: "Lembrete automático no 7º dia de atraso (cron diário).",
      },
      {
        chave: "wz_cobranca_atrasada_d15",
        label: "Cobrança atrasada — 15+ dias",
        descricao: "Aviso urgente no 15º dia de atraso (cron diário).",
      },
    ],
  },
  {
    titulo: "Leads / CRM",
    emoji: "📋",
    itens: [
      {
        chave: "wz_recontato_lead",
        label: "Recontato de lead",
        descricao: "Envio manual ou automático ao criar turma nova.",
      },
      {
        chave: "wz_followup_lead",
        label: "Follow-up de lead",
        descricao: "Mensagem automática para leads com próxima ação vencida (cron diário).",
      },
    ],
  },
  {
    titulo: "Agendamentos",
    emoji: "📅",
    itens: [
      {
        chave: "wz_agendamento_confirmacao",
        label: "Confirmação de agendamento",
        descricao: "Enviada imediatamente após o visitante confirmar um agendamento na página pública.",
      },
      {
        chave: "wz_lembrete_agendamento",
        label: "Lembrete de agendamento",
        descricao: "Aviso 1 dia antes do agendamento (cron diário).",
      },
      {
        chave: "wz_agendamento_cancelado",
        label: "Agendamento cancelado",
        descricao: "Notificação ao mudar o status do agendamento para Cancelado.",
      },
      {
        chave: "wz_agendamento_falta",
        label: "Falta no agendamento",
        descricao: 'Notificação ao mudar o status do agendamento para "Faltou".',
      },
    ],
  },
];

export function WhatsappNotificacoesForm({ defaultValues }: Props) {
  const [state, action, pending] = useActionState<WhatsappNotificacoesFormState, FormData>(
    salvarWhatsappNotificacoes,
    undefined,
  );
  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<string | null>(null);
  const [isPendingTeste, startTransitionTeste] = useTransition();

  function handleTestar() {
    if (!telefoneTeste) return;
    setResultadoTeste(null);
    startTransitionTeste(async () => {
      const res = await testarWhatsappNotificacaoAction(telefoneTeste);
      setResultadoTeste(res.ok ? "✅ Mensagem enviada no WhatsApp!" : `❌ ${res.erro}`);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {CATEGORIAS.map((cat) => (
        <div key={cat.titulo} className="flex flex-col gap-3">
          <p className="text-sm font-semibold">
            {cat.emoji} {cat.titulo}
          </p>
          <div className="flex flex-col gap-4">
            {cat.itens.map((item) => (
              <div key={item.chave} className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={item.chave} className="text-sm font-normal">
                    {item.label}
                  </Label>
                  <p className="text-muted-foreground text-xs">{item.descricao}</p>
                </div>
                <Switch
                  id={item.chave}
                  name={item.chave}
                  defaultChecked={defaultValues[item.chave]}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.salvo && <p className="text-sm text-green-600">Preferências salvas com sucesso.</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando…" : "Salvar preferências"}
      </Button>

      <div className="mt-2 border-t pt-4">
        <p className="mb-2 text-sm font-medium">Testar notificação</p>
        <p className="text-muted-foreground mb-3 text-xs">
          Envia uma mensagem de teste para o número informado usando a conexão GênZap configurada.
        </p>
        <div className="flex gap-2">
          <Input
            type="tel"
            placeholder="(99) 99999-9999"
            value={telefoneTeste}
            onChange={(e) => setTelefoneTeste(e.target.value)}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" size="sm" disabled={isPendingTeste || !telefoneTeste} onClick={handleTestar}>
            <Send />
            {isPendingTeste ? "Enviando…" : "Testar"}
          </Button>
        </div>
        {resultadoTeste && <p className="mt-2 text-sm">{resultadoTeste}</p>}
      </div>
    </form>
  );
}
