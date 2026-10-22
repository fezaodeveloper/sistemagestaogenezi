"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import {
  salvarTelegramNotificacoes,
  type TelegramNotificacoesFormState,
} from "@/app/admin/configuracoes/actions";
import { testarTelegramAction } from "@/app/admin/configuracoes/notificacoes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TelegramNotifConfig, TelegramNotifChave } from "@/lib/configuracoes/schema";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Salvando..." : "Salvar preferências"}
    </Button>
  );
}

type Categoria = {
  titulo: string;
  itens: { chave: TelegramNotifChave; label: string }[];
};

const CATEGORIAS: Categoria[] = [
  {
    titulo: "Financeiro",
    itens: [
      { chave: "tg_matricula_criada", label: "Nova matrícula criada" },
      { chave: "tg_pagamento_confirmado", label: "Pagamento confirmado" },
      { chave: "tg_pagamento_atrasado", label: "Pagamento em atraso" },
      { chave: "tg_cobranca_gerada", label: "Cobrança gerada" },
      { chave: "tg_resumo_financeiro_diario", label: "Resumo financeiro diário" },
      { chave: "tg_contrato_pendente", label: "Contrato pendente de assinatura" },
      { chave: "tg_parcela_vencendo_amanha", label: "Parcela vencendo amanhã" },
    ],
  },
  {
    titulo: "Alunos / LMS",
    itens: [
      { chave: "tg_aluno_cadastrado", label: "Novo aluno cadastrado" },
      { chave: "tg_curso_concluido", label: "Curso concluído" },
      { chave: "tg_certificado_gerado", label: "Certificado gerado" },
      { chave: "tg_aluno_sem_acesso", label: "Aluno sem acesso" },
      { chave: "tg_nota_reprovacao", label: "Nota de reprovação" },
      { chave: "tg_frequencia_baixa", label: "Frequência baixa" },
      { chave: "tg_evasao_risco", label: "Risco de evasão" },
    ],
  },
  {
    titulo: "Leads / CRM",
    itens: [
      { chave: "tg_lead_criado", label: "Novo lead criado" },
      { chave: "tg_lead_convertido", label: "Lead convertido em aluno" },
      { chave: "tg_lead_sem_followup", label: "Lead sem follow-up" },
    ],
  },
  {
    titulo: "Prêmios",
    itens: [
      { chave: "tg_premio_resgatado", label: "Prêmio resgatado" },
      { chave: "tg_estoque_baixo", label: "Estoque baixo" },
    ],
  },
  {
    titulo: "Agendamentos",
    itens: [
      { chave: "tg_agendamento_criado", label: "Agendamento criado" },
      { chave: "tg_agendamento_cancelado", label: "Agendamento cancelado" },
      { chave: "tg_lembrete_agendamento", label: "Lembrete de agendamento" },
    ],
  },
  {
    titulo: "Relatórios",
    itens: [
      { chave: "tg_relatorio_frequencia", label: "Relatório de frequência" },
      { chave: "tg_relatorio_semanal", label: "Relatório semanal" },
    ],
  },
  {
    titulo: "Gênezi Conecta",
    itens: [
      { chave: "tg_conecta_nova_postagem", label: "Nova postagem" },
      { chave: "tg_conecta_novo_comentario", label: "Novo comentário" },
    ],
  },
];

// Mesmo padrão de ConfiguracoesNotificacoesForm (sino): um formulário só, salvo com o botão
// "Salvar preferências" via useActionState — não auto-save por toggle (o projeto não tem
// sonner/toast instalado, e todo outro grupo de toggles desta mesma aba já funciona assim).
export function TelegramNotificacoesForm({ defaultValues }: { defaultValues: TelegramNotifConfig }) {
  const [state, formAction] = useActionState<TelegramNotificacoesFormState, FormData>(
    salvarTelegramNotificacoes,
    undefined,
  );
  const [resultadoTeste, setResultadoTeste] = useState<string | null>(null);
  const [isPendingTeste, startTransitionTeste] = useTransition();

  function handleTestar() {
    setResultadoTeste(null);
    startTransitionTeste(async () => {
      const res = await testarTelegramAction();
      setResultadoTeste(res.ok ? "✅ Mensagem enviada no Telegram!" : `❌ ${res.erro}`);
    });
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      {CATEGORIAS.map((categoria) => (
        <div key={categoria.titulo} className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm font-semibold">{categoria.titulo}</p>
          {categoria.itens.map(({ chave, label }) => (
            <div key={chave} className="flex items-center justify-between gap-4">
              <Label htmlFor={chave} className="font-normal">
                {label}
              </Label>
              <Switch id={chave} name={chave} defaultChecked={defaultValues[chave]} />
            </div>
          ))}
        </div>
      ))}

      <div className="mt-4 border-t pt-4">
        <Button type="button" variant="outline" size="sm" disabled={isPendingTeste} onClick={handleTestar}>
          <Send />
          {isPendingTeste ? "Enviando…" : "Testar notificação"}
        </Button>
        {resultadoTeste && <p className="mt-2 text-sm">{resultadoTeste}</p>}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.salvo && !state.error && <span className="text-muted-foreground text-sm">Salvo.</span>}
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
