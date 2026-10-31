-- TAREFA agendamentos — PARTE 5: confirmação automática de agendamento por WhatsApp.
--
-- PERGUNTA DE FATO 1 (investigação): criarAgendamentoPublico (src/app/agendar/[slug]/actions.ts)
-- NUNCA chamou nenhuma função de WhatsApp de verdade — só tinha um console.log comentado como
-- "confirmação automática ainda não tem template próprio". É exatamente por isso que o
-- agendamento de teste do Fernando não gerou nenhuma mensagem: não é falha de configuração nem
-- da Evolution API, é uma integração que nunca foi ligada.
--
-- Esta migration: (1) novo valor do enum mensagem_whatsapp_tipo (auditoria em
-- mensagens_enviadas), (2) novo toggle wz_agendamento_confirmacao em configuracoes (mesmo padrão
-- de 20261014120000_whatsapp_notif_toggles.sql).

alter type public.mensagem_whatsapp_tipo add value if not exists 'agendamento_confirmacao';

alter table public.configuracoes
  add column if not exists wz_agendamento_confirmacao boolean not null default true;

grant update (wz_agendamento_confirmacao) on public.configuracoes to authenticated;

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
