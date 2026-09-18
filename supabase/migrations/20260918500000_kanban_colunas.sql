-- Colunas do Kanban de leads configuráveis pelo admin (criar / renomear /
-- apagar) + grants que faltavam em `leads` para o combobox de curso.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== 1. Tabela de colunas =====
--
-- `id` é TEXT (não uuid) de propósito: leads.kanban_coluna já guarda
-- 'novo' | 'contato' | 'negociacao' | 'matriculado' | 'perdido' — as 5
-- colunas originais entram no seed com exatamente esses ids, então nenhum
-- lead precisa ser migrado. Colunas novas ganham um uuid (em texto).
--
-- DESVIO DA CONVENÇÃO — `created_by` é NULLABLE aqui: as 5 colunas do seed
-- são criadas pela migration (sem auth.uid()), e o padrão "created_by not
-- null" não teria como preenchê-las. Colunas criadas pelo admin pelo app
-- recebem auth.uid() normalmente (default).
create table public.kanban_colunas (
  id text primary key default gen_random_uuid()::text,
  nome text not null
    check (char_length(btrim(nome)) between 1 and 40),
  ordem integer not null default 0,
  cor text not null default '#6b7280'
    check (cor ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index kanban_colunas_ordem_idx on public.kanban_colunas (ordem);

alter table public.kanban_colunas enable row level security;

create policy "Admins gerenciam colunas do kanban"
  on public.kanban_colunas for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.kanban_colunas to authenticated;
grant select, insert, update, delete on public.kanban_colunas to service_role;

insert into public.kanban_colunas (id, nome, ordem, cor) values
  ('novo',        '🆕 Novo',        1, '#3b82f6'),
  ('contato',     '📞 Em contato',  2, '#f59e0b'),
  ('negociacao',  '🤝 Negociação',  3, '#a855f7'),
  ('matriculado', '✅ Matriculado', 4, '#22c55e'),
  ('perdido',     '❌ Perdido',     5, '#6b7280')
on conflict (id) do nothing;

-- ===== 2. leads.kanban_coluna passa a apontar pra kanban_colunas =====
--
-- O CHECK fixo (20260917900000_leads_kanban.sql) só aceitava os 5 valores
-- originais — bloquearia qualquer coluna nova. Removido sem depender do nome
-- da constraint (gerado automaticamente pelo Postgres).
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.leads'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kanban_coluna%'
  loop
    execute format('alter table public.leads drop constraint %I', r.conname);
  end loop;
end
$$;

-- No lugar do CHECK, uma FK: `on delete restrict` é a trava de banco pra
-- "só apaga coluna vazia" (a Server Action também confere antes, pra mostrar
-- mensagem amigável em vez de erro de constraint).
alter table public.leads drop constraint if exists leads_kanban_coluna_fkey;
alter table public.leads
  add constraint leads_kanban_coluna_fkey
  foreign key (kanban_coluna) references public.kanban_colunas (id)
  on update cascade
  on delete restrict;

-- ===== 3. Grants de leads que faltavam =====
--
-- A migration original só liberou update de (status, observacoes,
-- updated_at) e a do Kanban só as colunas de CRM. Faltava nome, telefone,
-- origem e curso_id — o combobox de curso do drawer precisa de curso_id, e
-- o formulário de edição do lead (updateLead) já grava os quatro. Continua
-- restrito a admin pela RLS ("Admins podem atualizar leads"). Idempotente.
grant update (nome, telefone, curso_id, origem) on public.leads to authenticated;
