-- TAREFA 2 — Termos (uso, imagem, privacidade, outro). Mostrada para
-- revisão, NÃO aplicada nesta rodada.

create table public.termos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'outro'
    check (tipo in ('uso', 'imagem', 'privacidade', 'outro')),
  conteudo text not null,
  ativo boolean not null default true,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.termos enable row level security;

create policy "Admins gerenciam termos"
  on public.termos for all using (public.is_admin());
create policy "Alunos podem ver termos ativos"
  on public.termos for select using (ativo = true);

grant select on public.termos to authenticated;
grant insert (titulo, tipo, conteudo, ativo, created_by)
  on public.termos to authenticated;
grant update (titulo, tipo, conteudo, ativo)
  on public.termos to authenticated;
grant delete on public.termos to authenticated;
grant select, insert, update, delete on public.termos to service_role;

create trigger on_termos_updated
  before update on public.termos
  for each row execute function public.handle_updated_at();
