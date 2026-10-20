-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Templates reutilizáveis de notificação push (admin). Escritos só por admin autenticado
-- (Server Actions com requireRole("admin") + createClient() normal) — por isso created_by
-- "not null default auth.uid()" é seguro (convenção padrão do CLAUDE.md), diferente das tabelas
-- dos fluxos sem login desta mesma sessão (contratos_assinados/termos_imagem_assinados).

create table public.push_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  titulo text not null,
  corpo text not null,
  tipo text not null default 'aviso_geral'
    check (tipo in ('lembrete_pagamento', 'lembrete_aula', 'recesso', 'feriado', 'aviso_geral')),
  ativo boolean not null default true,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_templates enable row level security;

create policy "Admins gerenciam templates push"
  on public.push_templates for all using (public.is_admin());

create trigger on_push_templates_updated
  before update on public.push_templates
  for each row execute function public.handle_updated_at();

grant select on public.push_templates to authenticated;
grant insert (nome, titulo, corpo, tipo, ativo) on public.push_templates to authenticated;
grant update (nome, titulo, corpo, tipo, ativo) on public.push_templates to authenticated;
grant delete on public.push_templates to authenticated;
grant select, insert, update, delete on public.push_templates to service_role;
