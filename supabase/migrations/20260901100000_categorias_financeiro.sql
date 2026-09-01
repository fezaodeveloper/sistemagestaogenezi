-- Categorias dinâmicas de gastos e pagamentos avulsos, substituindo os
-- enums fixos (GASTO_CATEGORIAS / PAGAMENTO_AVULSO_TIPOS em
-- src/lib/financeiro/schema.ts) por tabelas editáveis pelo admin.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== Categorias de gastos =====

create table public.categorias_gastos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default '#6B7280',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categorias_gastos enable row level security;

create policy "Admins gerenciam categorias de gastos"
  on public.categorias_gastos for all using (public.is_admin());

grant select, insert, update, delete on public.categorias_gastos to authenticated;
grant select, insert, update, delete on public.categorias_gastos to service_role;

create trigger on_categorias_gastos_updated
  before update on public.categorias_gastos
  for each row execute function public.handle_updated_at();

-- Migra os valores do enum GASTO_CATEGORIAS como linhas iniciais — o admin
-- pode editar nome/cor ou desativar depois pela tela de categorias.
insert into public.categorias_gastos (nome, cor, ordem) values
  ('Aluguel', '#EF4444', 1),
  ('Material', '#3B82F6', 2),
  ('Salário', '#10B981', 3),
  ('Marketing', '#8B5CF6', 4),
  ('Manutenção', '#F59E0B', 5),
  ('Outro', '#6B7280', 6);

-- ===== Categorias de pagamentos avulsos =====

create table public.categorias_avulsos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default '#6B7280',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categorias_avulsos enable row level security;

create policy "Admins gerenciam categorias de avulsos"
  on public.categorias_avulsos for all using (public.is_admin());

grant select, insert, update, delete on public.categorias_avulsos to authenticated;
grant select, insert, update, delete on public.categorias_avulsos to service_role;

create trigger on_categorias_avulsos_updated
  before update on public.categorias_avulsos
  for each row execute function public.handle_updated_at();

insert into public.categorias_avulsos (nome, cor, ordem) values
  ('Receita', '#10B981', 1),
  ('Taxa', '#F59E0B', 2),
  ('Outro', '#6B7280', 3);

-- ===== FK de categoria dinâmica em gastos e pagamentos_avulsos =====
-- O campo texto existente (gastos.categoria / pagamentos_avulsos.tipo)
-- continua no banco sem alteração, exibido para registros históricos que
-- não têm categoria_id — os formulários de criação (TAREFA 5C) passam a
-- gravar só categoria_id, não mais o texto do enum antigo.

alter table public.gastos
  add column if not exists categoria_id uuid references public.categorias_gastos (id) on delete set null;

alter table public.pagamentos_avulsos
  add column if not exists categoria_id uuid references public.categorias_avulsos (id) on delete set null;

-- gastos.categoria era "not null" sem default (ver
-- 20260911100000_modulo_financeiro.sql) porque era a única forma de
-- categorizar um gasto. Com categoria_id assumindo esse papel pra
-- registros novos, a coluna vira opcional — sem isso, criarGasto()
-- passaria a falhar com "null value in column categoria" ao parar de
-- enviar o texto do enum fixo. O check também é removido: categorias
-- dinâmicas não têm como satisfazer uma lista fixa de valores.
-- (pagamentos_avulsos.tipo não precisa do mesmo ajuste: já tem
-- `default 'receita'`, então continua aceitando insert sem o campo.)
alter table public.gastos alter column categoria drop not null;
alter table public.gastos drop constraint if exists gastos_categoria_check;

grant insert (categoria_id) on public.gastos to authenticated;
grant update (categoria_id) on public.gastos to authenticated;
grant insert (categoria_id) on public.pagamentos_avulsos to authenticated;
grant update (categoria_id) on public.pagamentos_avulsos to authenticated;
