create type public.curso_tipo as enum ('presencial', 'ead', 'hibrido');
create type public.curso_status as enum ('ativo', 'inativo');

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  tipo public.curso_tipo not null,
  status public.curso_status not null default 'ativo',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cursos enable row level security;

create policy "Admins podem ver cursos"
  on public.cursos for select using (public.is_admin());

create policy "Admins podem criar cursos"
  on public.cursos for insert with check (public.is_admin());

create policy "Admins podem atualizar cursos"
  on public.cursos for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir cursos"
  on public.cursos for delete using (public.is_admin());

-- Reaproveita a função já criada na migration de profiles (Fase 2).
create trigger on_cursos_updated
  before update on public.cursos
  for each row execute function public.handle_updated_at();

grant select on public.cursos to authenticated;
grant insert (nome, descricao, tipo, status) on public.cursos to authenticated;
grant update (nome, descricao, tipo, status) on public.cursos to authenticated;
grant delete on public.cursos to authenticated;
