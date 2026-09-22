-- Controle de envio da recuperação escalonada por SMS: uma linha por (lead, etapa) já tratada.
-- O unique(lead_id, etapa_index) é o que garante que a mesma etapa nunca sai duas vezes para o
-- mesmo lead — mesmo com duas execuções do cron ao mesmo tempo (o cron "reserva" a etapa
-- inserindo a linha ANTES de enviar; se o envio falha, apaga a reserva e tenta na próxima execução).
--
-- Escrita só pelo cron (service_role, sem sessão): sem "created_by" (convenção padrão, CLAUDE.md) —
-- mesma exceção de mensagens_enviadas/leads públicos. Leitura só do admin.
--
-- Depende de 20260921500000_sms_templates.sql? Não: só de public.leads.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.sms_recuperacao_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  -- Posição da etapa na lista de etapas (ordenada por horas) no momento do envio.
  etapa_index integer not null check (etapa_index >= 0),
  -- 'enviado' = SMS entregue à IntegraX; 'ignorada' = etapa que já estava atrasada quando o cron
  -- passou e foi SUBSTITUÍDA por uma etapa mais avançada (evita mandar 3 SMS de uma vez a um lead
  -- cadastrado há dias — o cron roda 1x por dia).
  status text not null default 'enviado' check (status in ('enviado', 'ignorada')),
  -- Momento em que a etapa foi tratada (enviada ou ignorada).
  enviado_at timestamptz not null default now(),
  constraint sms_recuperacao_log_lead_etapa_uniq unique (lead_id, etapa_index)
);

create index sms_recuperacao_log_enviado_at_idx on public.sms_recuperacao_log (enviado_at desc);

alter table public.sms_recuperacao_log enable row level security;

create policy "Admins veem o log da recuperação por SMS"
  on public.sms_recuperacao_log for select
  using (public.is_admin());

-- O admin só lê; quem escreve é o cron (service_role, que bypassa a RLS mas precisa do grant).
grant select on public.sms_recuperacao_log to authenticated;
grant select, insert, update, delete on public.sms_recuperacao_log to service_role;
