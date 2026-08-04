create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  numero integer not null,
  titulo text not null,
  conteudo text,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aulas_numero_check check (numero > 0)
);

-- Postgres não indexa FK automaticamente — sem isso, toda listagem por curso
-- faria table scan.
create index aulas_curso_id_idx on public.aulas (curso_id);

-- Evita duas aulas com o mesmo número dentro do mesmo curso.
create unique index aulas_curso_numero_uidx on public.aulas (curso_id, numero);

alter table public.aulas enable row level security;

create policy "Admins podem ver aulas"
  on public.aulas for select using (public.is_admin());
create policy "Admins podem criar aulas"
  on public.aulas for insert with check (public.is_admin());
create policy "Admins podem atualizar aulas"
  on public.aulas for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir aulas"
  on public.aulas for delete using (public.is_admin());

create trigger on_aulas_updated
  before update on public.aulas
  for each row execute function public.handle_updated_at();

grant select on public.aulas to authenticated;
grant insert (curso_id, numero, titulo, conteudo) on public.aulas to authenticated;
grant update (numero, titulo, conteudo) on public.aulas to authenticated;
grant delete on public.aulas to authenticated;
