-- API pública do sistema (/api/v1/*) para integração com N8n e outros
-- serviços externos — autenticação por API Key (header X-API-Key), sem
-- sessão de usuário.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  chave text unique not null,
  permissoes jsonb not null default '["alunos","matriculas","financeiro","leads","presencas","eventos"]',
  ativa boolean not null default true,
  ultimo_uso timestamptz,
  total_requisicoes integer not null default 0,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;

create policy "Admins gerenciam API keys"
  on public.api_keys for all using (public.is_admin());

grant select, insert, update, delete on public.api_keys to authenticated;
grant select, update on public.api_keys to service_role;

create trigger on_api_keys_updated
  before update on public.api_keys
  for each row execute function public.handle_updated_at();

-- public.eventos_calendario nunca recebeu grant pra service_role (só
-- authenticated, ver 20260910100000_calendario_academico.sql) — não dava
-- problema até agora porque nada usava o client admin pra ler essa tabela.
-- O endpoint GET /api/v1/eventos (src/app/api/v1/eventos/route.ts) passa a
-- consultar via supabaseAdmin, então o grant fica necessário agora. Mesmo
-- padrão amplo das outras concessões a service_role.
grant select, insert, update, delete on public.eventos_calendario to service_role;
