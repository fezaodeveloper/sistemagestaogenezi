-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Agendamentos de notificação push pra uma data/hora futura. Criados por admin autenticado
-- (created_by "not null default auth.uid()", mesma justificativa de push_templates); lidos e
-- marcados como enviados pelo cron /api/cron/push-agendamentos, que roda sem sessão (sempre via
-- createAdminClient()) — por isso o grant amplo pra service_role.
--
-- "turma_id" referencia turmas diretamente (não alunos.turma_id, que é coluna legada nunca
-- preenchida pelo app — ver CLAUDE.md/comentário em create_alunos.sql); o cron resolve quem
-- recebe via matriculas ativas dessa turma, não via alunos.turma_id.

create table public.push_agendamentos (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.push_templates (id) on delete set null,
  titulo text not null,
  corpo text not null,
  destinatarios text not null default 'todos'
    check (destinatarios in ('todos', 'ativos', 'turma')),
  turma_id uuid references public.turmas (id) on delete set null,
  agendado_para timestamptz not null,
  enviado_em timestamptz,
  total_enviado integer,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index push_agendamentos_pendentes_idx
  on public.push_agendamentos (agendado_para)
  where enviado_em is null;

alter table public.push_agendamentos enable row level security;

create policy "Admins gerenciam agendamentos push"
  on public.push_agendamentos for all using (public.is_admin());

grant select on public.push_agendamentos to authenticated;
grant insert (template_id, titulo, corpo, destinatarios, turma_id, agendado_para) on public.push_agendamentos to authenticated;
grant delete on public.push_agendamentos to authenticated;
grant select, insert, update, delete on public.push_agendamentos to service_role;
