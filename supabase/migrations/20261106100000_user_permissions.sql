-- NÃO APLICADA

-- Permissões granulares por usuário/módulo/ação (aba Usuários em /admin/configuracoes).
-- Fase 1: só guarda o dado. Não aplica restrição de navegação/menu ainda — isso é escopo
-- futuro (requireRole() está espalhado em ~40 page.tsx individuais; integrar precisa de
-- revisão própria). hasPermission() (src/lib/auth/permissions.ts) já existe pra quando essa
-- fase futura chegar.

create type public.admin_modulo as enum (
  'visao_geral',
  'matriculas',
  'academico',
  'genezi_conecta',
  'financeiro',
  'comercial',
  'engajamento',
  'notificacoes',
  'sistema',
  'legal'
);

create type public.admin_acao as enum ('ler', 'editar', 'excluir');

create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  modulo public.admin_modulo not null,
  acao public.admin_acao not null,
  permitido boolean not null default false,
  -- Sem "default auth.uid()" (padrão do CLAUDE.md pra created_by): toda escrita aqui roda via
  -- createAdminClient()/service_role (ver actions-usuarios.ts e permissions.ts), que não tem
  -- sessão de usuário — auth.uid() seria null e violaria o not null. created_by é sempre
  -- passado explicitamente pelo id do admin autenticado (requireRole("admin") já devolve). Sem
  -- "on delete cascade": só admin preenche esta coluna, e conta admin não é excluída na
  -- prática (mesma regra de toda outra tabela do projeto com created_by só-admin).
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, modulo, acao)
);

create index idx_user_permissions_user_id on public.user_permissions (user_id);

alter table public.user_permissions enable row level security;

-- Política explícita por ALL via is_admin() (mesmo padrão de "Admins gerenciam empresas" em
-- empresas_conecta, 20260916800000_genezi_conecta.sql) em vez de um "using (true)" solto —
-- defesa em profundidade, já que hoje só service_role toca esta tabela (bypassa RLS de
-- qualquer forma) e nenhum grant é dado a "authenticated".
create policy "Admins gerenciam permissões de usuários"
  on public.user_permissions for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.user_permissions to service_role;

create trigger on_user_permissions_updated
  before update on public.user_permissions
  for each row execute function public.handle_updated_at();

-- ===== "Ativo agora" (indicador de sessão ativa na aba Usuários) =====

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Sem grant novo: profiles já tem "grant select, insert, update, delete ... to service_role"
-- (20260731150000_grant_service_role_profiles.sql) — grant de TABELA INTEIRA, não por coluna,
-- então cobre last_seen_at automaticamente (confirmado lendo essa migration antes de escrever
-- esta). src/proxy.ts é quem escreve esta coluna, sempre via createAdminClient().
