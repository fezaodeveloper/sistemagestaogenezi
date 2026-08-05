create table public.modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  numero integer not null,
  titulo text not null,
  descricao text,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modulos_numero_check check (numero > 0)
);

create index modulos_curso_id_idx on public.modulos (curso_id);
create unique index modulos_curso_numero_uidx on public.modulos (curso_id, numero);

alter table public.modulos enable row level security;

create policy "Admins podem ver modulos"
  on public.modulos for select using (public.is_admin());
create policy "Admins podem criar modulos"
  on public.modulos for insert with check (public.is_admin());
create policy "Admins podem atualizar modulos"
  on public.modulos for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir modulos"
  on public.modulos for delete using (public.is_admin());

create trigger on_modulos_updated
  before update on public.modulos
  for each row execute function public.handle_updated_at();

grant select on public.modulos to authenticated;
grant insert (curso_id, numero, titulo, descricao) on public.modulos to authenticated;
grant update (numero, titulo, descricao) on public.modulos to authenticated;
grant delete on public.modulos to authenticated;

-- Migra aulas existentes: cria um "Módulo 1" por curso que já tem aulas, e
-- reatribui essas aulas a ele, antes de trocar curso_id por modulo_id.
alter table public.aulas add column modulo_id uuid references public.modulos (id) on delete cascade;

-- min()/max() não existem pra uuid no Postgres — usa distinct on, ordenado
-- pela aula mais antiga de cada curso, pra escolher um created_by de forma
-- determinística (em vez de min(created_by), que nem compilaria).
insert into public.modulos (curso_id, numero, titulo, created_by)
select distinct on (curso_id) curso_id, 1, 'Módulo 1', created_by
from public.aulas
order by curso_id, created_at;

update public.aulas a
set modulo_id = m.id
from public.modulos m
where m.curso_id = a.curso_id and m.numero = 1;

alter table public.aulas alter column modulo_id set not null;

drop index aulas_curso_numero_uidx;
create unique index aulas_modulo_numero_uidx on public.aulas (modulo_id, numero);

drop index aulas_curso_id_idx;
create index aulas_modulo_id_idx on public.aulas (modulo_id);

-- Dropar a coluna já remove o grant específico dela (curso_id) junto —
-- não precisa de revoke explícito, e tentar revogar depois do drop dá erro
-- ("column curso_id does not exist").
alter table public.aulas drop column curso_id;

grant insert (modulo_id) on public.aulas to authenticated;
