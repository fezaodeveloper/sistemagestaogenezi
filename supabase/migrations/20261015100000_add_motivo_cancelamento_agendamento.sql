-- Motivo de cancelamento de agendamento (aba "Cancelados" do Kanban) — antes só ia pra
-- mensagem de WhatsApp (notificarWhatsappAgendamentoCancelado), nunca era persistido.
--
-- Sem grant novo: a migration 20260918400000_agendamentos_grants_admin.sql já concede
-- "update" na tabela inteira (sem lista de colunas) pra authenticated — cobre esta coluna nova
-- automaticamente. RLS continua restringindo a is_admin() via "Admins gerenciam agendamentos".
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.agendamentos add column if not exists motivo_cancelamento text;
