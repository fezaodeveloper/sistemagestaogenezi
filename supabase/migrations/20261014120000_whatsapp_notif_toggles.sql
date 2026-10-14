-- Migration: WhatsApp notification toggles
-- Adds 14 wz_* boolean columns to configuracoes (single-row settings table).
-- All default to TRUE so existing automations keep working after deploy.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  add column if not exists wz_matricula_criada      boolean not null default true,
  add column if not exists wz_lembrete_aula          boolean not null default true,
  add column if not exists wz_falta_aula             boolean not null default true,
  add column if not exists wz_dados_acesso           boolean not null default true,
  add column if not exists wz_cobranca_gerada        boolean not null default true,
  add column if not exists wz_cobranca_atrasada_d1   boolean not null default true,
  add column if not exists wz_cobranca_atrasada_d3   boolean not null default true,
  add column if not exists wz_cobranca_atrasada_d7   boolean not null default true,
  add column if not exists wz_cobranca_atrasada_d15  boolean not null default true,
  add column if not exists wz_recontato_lead         boolean not null default true,
  add column if not exists wz_followup_lead          boolean not null default true,
  add column if not exists wz_lembrete_agendamento   boolean not null default true,
  add column if not exists wz_agendamento_cancelado  boolean not null default true,
  add column if not exists wz_agendamento_falta      boolean not null default true;

-- SELECT já é liberado pra authenticated na tabela toda desde 20260821100000_create_pontos_gamificacao.sql
-- — só falta o GRANT de UPDATE pras colunas novas (mesmo padrão de 20261013100000_telegram_notif_toggles.sql).
grant update (
  wz_matricula_criada,
  wz_lembrete_aula,
  wz_falta_aula,
  wz_dados_acesso,
  wz_cobranca_gerada,
  wz_cobranca_atrasada_d1,
  wz_cobranca_atrasada_d3,
  wz_cobranca_atrasada_d7,
  wz_cobranca_atrasada_d15,
  wz_recontato_lead,
  wz_followup_lead,
  wz_lembrete_agendamento,
  wz_agendamento_cancelado,
  wz_agendamento_falta
) on public.configuracoes to authenticated;
