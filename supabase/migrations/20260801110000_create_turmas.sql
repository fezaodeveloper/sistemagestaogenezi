create type public.turma_status as enum ('planejada', 'ativa', 'encerrada', 'cancelada');

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete restrict,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  capacidade_maxima integer not null,
  status public.turma_status not null default 'planejada',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turmas_datas_check check (data_fim >= data_inicio),
  constraint turmas_capacidade_check check (capacidade_maxima > 0)
);

-- Postgres não indexa FK automaticamente — sem isso, toda listagem/join por
-- curso faria table scan.
create index turmas_curso_id_idx on public.turmas (curso_id);

alter table public.turmas enable row level security;

create policy "Admins podem ver turmas"
  on public.turmas for select using (public.is_admin());

create policy "Admins podem criar turmas"
  on public.turmas for insert with check (public.is_admin());

create policy "Admins podem atualizar turmas"
  on public.turmas for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir turmas"
  on public.turmas for delete using (public.is_admin());

-- Reaproveita a função já criada na migration de profiles (Fase 2).
create trigger on_turmas_updated
  before update on public.turmas
  for each row execute function public.handle_updated_at();

grant select on public.turmas to authenticated;
grant insert (curso_id, nome, data_inicio, data_fim, capacidade_maxima, status) on public.turmas to authenticated;
grant update (curso_id, nome, data_inicio, data_fim, capacidade_maxima, status) on public.turmas to authenticated;
grant delete on public.turmas to authenticated;
