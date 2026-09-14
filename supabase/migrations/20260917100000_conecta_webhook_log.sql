-- Gênezi Conecta — Etapa 4: log de webhook da assinatura (candidatos
-- externos pagos) + correção de FK em perfis_conecta.
--
-- Nome do arquivo ajustado de 20260913300000 (pedido original) para
-- 20260917100000: 20260913300000 é anterior a 20260916800000
-- (genezi_conecta, que cria perfis_conecta) e 20260917000000 (última
-- migration já aplicada) — usar o timestamp pedido rodaria esta migration
-- ANTES das tabelas que ela referencia numa reconstrução do banco do zero.
--
-- Mostrar SQL — NÃO aplicar.

create table public.log_webhooks_conecta (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  asaas_event_id text not null unique,
  asaas_payment_id text,
  asaas_subscription_id text,
  payload jsonb,
  processado boolean not null default false,
  erro text,
  created_at timestamptz not null default now()
);

alter table public.log_webhooks_conecta enable row level security;

create policy "Admins veem log webhook conecta"
  on public.log_webhooks_conecta for all using (public.is_admin());

-- Sem policy de insert/update pra "authenticated": o endpoint de webhook
-- (src/app/api/webhooks/asaas-conecta/route.ts) grava com o client admin
-- (service_role), que bypassa RLS mas ainda precisa do grant abaixo — mesmo
-- padrão de log_webhooks_asaas (20260911100000_modulo_financeiro.sql).
grant select on public.log_webhooks_conecta to authenticated;
grant select, insert, update on public.log_webhooks_conecta to service_role;

-- Bug encontrado nesta etapa: perfis_conecta.aluno_id referencia
-- public.alunos(id), não public.profiles(id) (ver 20260916800000). Isso
-- funciona pra alunos de verdade (alunos.id = profiles.id, 1:1) mas quebra
-- pra candidatos EXTERNOS: a conta é criada só em auth.users + profiles
-- (via handle_new_user), sem linha correspondente em alunos, porque um
-- externo não é um aluno matriculado. O INSERT em perfis_conecta pedido na
-- TAREFA 2 (aluno_id: userId, tipo: 'externo') violaria essa FK. Corrigido
-- apontando aluno_id pra profiles(id) — cobre os dois casos (aluno e
-- externo), já que todo profile tem role 'aluno' independente de ter ou não
-- uma linha em alunos.
alter table public.perfis_conecta drop constraint perfis_conecta_aluno_id_fkey;
alter table public.perfis_conecta
  add constraint perfis_conecta_aluno_id_fkey
  foreign key (aluno_id) references public.profiles(id) on delete cascade;
