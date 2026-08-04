create type public.matricula_status as enum ('ativa', 'concluida', 'cancelada', 'transferida');

create table public.matriculas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  turma_id uuid not null references public.turmas (id) on delete restrict,
  data_matricula date not null default current_date,
  status public.matricula_status not null default 'ativa',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index matriculas_aluno_id_idx on public.matriculas (aluno_id);
create index matriculas_turma_id_idx on public.matriculas (turma_id);

-- Duas matrículas ativas do mesmo aluno na MESMA turma não fazem sentido
-- (duplicidade) — mas o mesmo aluno pode ter matrículas ativas em turmas
-- diferentes ao mesmo tempo, então a restrição é por (aluno_id, turma_id),
-- não por aluno_id sozinho.
create unique index matriculas_aluno_turma_ativa_uidx
  on public.matriculas (aluno_id, turma_id)
  where status = 'ativa';

alter table public.matriculas enable row level security;

create policy "Admins podem ver matriculas"
  on public.matriculas for select using (public.is_admin());
create policy "Admins podem criar matriculas"
  on public.matriculas for insert with check (public.is_admin());
create policy "Admins podem atualizar matriculas"
  on public.matriculas for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir matriculas"
  on public.matriculas for delete using (public.is_admin());

create trigger on_matriculas_updated
  before update on public.matriculas
  for each row execute function public.handle_updated_at();

-- Migra o vínculo atual (alunos.turma_id) para matrícula formal, antes de
-- remover a coluna. data_matricula usa a data de criação do aluno — melhor
-- aproximação disponível hoje, já que não existia data de matrícula real.
insert into public.matriculas (aluno_id, turma_id, data_matricula, status, created_by)
select id, turma_id, created_at::date, 'ativa', created_by
from public.alunos
where turma_id is not null;

-- Sem "a turma" única pra derivar quando há múltiplas matrículas ativas.
-- O índice alunos_turma_id_idx (Fase 3) é removido junto, automaticamente.
alter table public.alunos drop column turma_id;

grant select on public.matriculas to authenticated;
grant insert (aluno_id, turma_id, data_matricula, status) on public.matriculas to authenticated;
grant update (status) on public.matriculas to authenticated;
grant delete on public.matriculas to authenticated;
