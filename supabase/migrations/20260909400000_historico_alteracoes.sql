-- 3 implementações independentes, num arquivo único por pedido explícito da
-- tarefa: histórico de alterações (TAREFA 3), notificações push no
-- navegador (TAREFA 4) e controle de recursos por tipo de curso (TAREFA 5).
-- Mostrar SQL — NÃO aplicar.

-- ===== PARTE 1: histórico de alterações (TAREFA 3) =====

create table public.historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  alterado_por uuid references public.profiles(id),
  alterado_em timestamptz not null default now()
);

create index historico_registro_idx
  on public.historico_alteracoes(tabela, registro_id);

alter table public.historico_alteracoes enable row level security;

create policy "Admins veem histórico"
  on public.historico_alteracoes for all using (public.is_admin());

grant select on public.historico_alteracoes to authenticated;
grant select, insert on public.historico_alteracoes to service_role;

-- ===== PARTE 2: notificações push no navegador (TAREFA 4) =====

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Admins gerenciam push"
  on public.push_subscriptions for all using (public.is_admin());

grant select, insert, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

-- push_vapid_private_key nunca deve ser lido pelo client autenticado (só
-- pelo client admin, ao montar o payload de envio em
-- src/lib/push/enviar.ts) — mas como não há RLS de coluna no Postgres, o
-- controle de "nunca expor a chave privada" fica a cargo do código: o
-- select feito do lado do admin (configuracoes/page.tsx) nunca inclui essa
-- coluna, só push_vapid_public_key.
alter table public.configuracoes
  add column if not exists push_vapid_public_key text,
  add column if not exists push_vapid_private_key text;

grant update (push_vapid_public_key, push_vapid_private_key)
  on public.configuracoes to authenticated;

-- ===== PARTE 3: controle de recursos por tipo de curso (TAREFA 5) =====

alter table public.configuracoes
  add column if not exists recurso_gamificacao_presencial boolean default true,
  add column if not exists recurso_gamificacao_ead boolean default true,
  add column if not exists recurso_gamificacao_hibrido boolean default true,
  add column if not exists recurso_premios_presencial boolean default true,
  add column if not exists recurso_premios_ead boolean default true,
  add column if not exists recurso_premios_hibrido boolean default true,
  add column if not exists recurso_ranking_presencial boolean default true,
  add column if not exists recurso_ranking_ead boolean default true,
  add column if not exists recurso_ranking_hibrido boolean default true,
  add column if not exists recurso_chat_presencial boolean default true,
  add column if not exists recurso_chat_ead boolean default true,
  add column if not exists recurso_chat_hibrido boolean default true,
  add column if not exists recurso_certificados_presencial boolean default true,
  add column if not exists recurso_certificados_ead boolean default true,
  add column if not exists recurso_certificados_hibrido boolean default true;

grant update (
  recurso_gamificacao_presencial, recurso_gamificacao_ead, recurso_gamificacao_hibrido,
  recurso_premios_presencial, recurso_premios_ead, recurso_premios_hibrido,
  recurso_ranking_presencial, recurso_ranking_ead, recurso_ranking_hibrido,
  recurso_chat_presencial, recurso_chat_ead, recurso_chat_hibrido,
  recurso_certificados_presencial, recurso_certificados_ead, recurso_certificados_hibrido
) on public.configuracoes to authenticated;
