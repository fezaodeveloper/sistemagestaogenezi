-- CRM Kanban com follow-up automático de até 7 dias (roadmap, item 3).
-- Sem Evolution API por enquanto — o cron de follow-up só registra a
-- intenção (stub), a integração real vem depois.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.leads
  add column if not exists kanban_coluna text not null default 'novo'
    check (kanban_coluna in ('novo','contato','negociacao','matriculado','perdido')),
  add column if not exists temperatura text default 'morno'
    check (temperatura in ('quente','morno','frio')),
  add column if not exists proxima_acao date,
  add column if not exists notas text,
  add column if not exists campanha_origem text,
  add column if not exists followup_count integer not null default 0,
  add column if not exists ultimo_followup timestamptz;

grant update (kanban_coluna, temperatura, proxima_acao, notas,
  campanha_origem, followup_count, ultimo_followup)
  on public.leads to authenticated;
