-- Motor de Automações (Etapa 13): fila best-effort de eventos processados
-- de forma síncrona (sem fila externa) no momento em que são disparados,
-- com idempotência via idempotency_key e log de auditoria separado do
-- estado transacional de cada evento.

create table public.eventos_automacao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  payload jsonb not null default '{}',
  idempotency_key text unique not null,
  status text not null default 'pendente'
    check (status in ('pendente','processando','concluido','falhou','ignorado')),
  tentativas integer not null default 0,
  max_tentativas integer not null default 3,
  erro text,
  processado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index eventos_automacao_status_idx on public.eventos_automacao(status);
create index eventos_automacao_tipo_idx on public.eventos_automacao(tipo);
create index eventos_automacao_created_idx on public.eventos_automacao(created_at);

create table public.log_automacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.eventos_automacao(id) on delete set null,
  tipo text not null,
  descricao text not null,
  payload jsonb,
  sucesso boolean not null default true,
  erro text,
  created_at timestamptz not null default now()
);

create index log_automacoes_evento_id_idx on public.log_automacoes(evento_id);
create index log_automacoes_tipo_idx on public.log_automacoes(tipo);
create index log_automacoes_created_idx on public.log_automacoes(created_at);

alter table public.eventos_automacao enable row level security;
alter table public.log_automacoes enable row level security;

create policy "Admins podem ver eventos de automação"
  on public.eventos_automacao for select using (public.is_admin());
create policy "Admins podem ver log de automações"
  on public.log_automacoes for select using (public.is_admin());

-- service_role tem acesso total (usado pelo motor internamente, via
-- src/lib/supabase/admin.ts — nunca pelo client autenticado do usuário).
grant select, insert, update on public.eventos_automacao to service_role;
grant select, insert on public.log_automacoes to service_role;
grant select on public.eventos_automacao to authenticated;
grant select on public.log_automacoes to authenticated;

create trigger on_eventos_automacao_updated
  before update on public.eventos_automacao
  for each row execute function public.handle_updated_at();

-- public.presencas nunca recebeu grant pra service_role (só authenticated,
-- ver 20260806100000_create_presencas.sql) — não dava problema até agora
-- porque nada usava o client admin pra ler essa tabela. O resumo diário e o
-- relatório semanal (src/lib/automacoes/handlers/) e a Saúde da Escola
-- reaproveitada no relatório semanal (src/lib/admin/saude.ts) passam a
-- consultar presencas via supabaseAdmin, então o grant fica necessário
-- agora. Mesmo padrão amplo das outras concessões a service_role.
grant select, insert, update, delete on public.presencas to service_role;
