create type public.questao_tipo as enum ('multipla_escolha', 'verdadeiro_falso', 'dissertativa');

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null unique references public.aulas (id) on delete cascade,
  titulo text not null,
  nota_minima_ativa boolean not null default false,
  nota_minima_percentual integer,
  tentativas_limitadas boolean not null default false,
  tentativas_maximas integer,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_nota_minima_check check (
    (nota_minima_ativa and nota_minima_percentual between 1 and 100)
    or (not nota_minima_ativa and nota_minima_percentual is null)
  ),
  constraint quizzes_tentativas_check check (
    (tentativas_limitadas and tentativas_maximas > 0)
    or (not tentativas_limitadas and tentativas_maximas is null)
  )
);

alter table public.quizzes enable row level security;

create policy "Admins podem ver quizzes"
  on public.quizzes for select using (public.is_admin());
create policy "Admins podem criar quizzes"
  on public.quizzes for insert with check (public.is_admin());
create policy "Admins podem atualizar quizzes"
  on public.quizzes for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir quizzes"
  on public.quizzes for delete using (public.is_admin());

create trigger on_quizzes_updated
  before update on public.quizzes
  for each row execute function public.handle_updated_at();

grant select on public.quizzes to authenticated;
grant insert (aula_id, titulo, nota_minima_ativa, nota_minima_percentual, tentativas_limitadas, tentativas_maximas)
  on public.quizzes to authenticated;
grant update (titulo, nota_minima_ativa, nota_minima_percentual, tentativas_limitadas, tentativas_maximas)
  on public.quizzes to authenticated;
grant delete on public.quizzes to authenticated;

create table public.questoes (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  tipo public.questao_tipo not null,
  enunciado text not null,
  ordem integer not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questoes_ordem_check check (ordem > 0)
);

create index questoes_quiz_id_idx on public.questoes (quiz_id);

alter table public.questoes enable row level security;

create policy "Admins podem ver questoes"
  on public.questoes for select using (public.is_admin());
create policy "Admins podem criar questoes"
  on public.questoes for insert with check (public.is_admin());
create policy "Admins podem atualizar questoes"
  on public.questoes for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir questoes"
  on public.questoes for delete using (public.is_admin());

create trigger on_questoes_updated
  before update on public.questoes
  for each row execute function public.handle_updated_at();

grant select on public.questoes to authenticated;
grant insert (quiz_id, tipo, enunciado, ordem) on public.questoes to authenticated;
grant update (tipo, enunciado, ordem) on public.questoes to authenticated;
grant delete on public.questoes to authenticated;

create table public.alternativas (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references public.questoes (id) on delete cascade,
  texto text not null,
  correta boolean not null default false,
  ordem integer not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alternativas_ordem_check check (ordem > 0)
);

create index alternativas_questao_id_idx on public.alternativas (questao_id);

alter table public.alternativas enable row level security;

create policy "Admins podem ver alternativas"
  on public.alternativas for select using (public.is_admin());
create policy "Admins podem criar alternativas"
  on public.alternativas for insert with check (public.is_admin());
create policy "Admins podem atualizar alternativas"
  on public.alternativas for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir alternativas"
  on public.alternativas for delete using (public.is_admin());

create trigger on_alternativas_updated
  before update on public.alternativas
  for each row execute function public.handle_updated_at();

grant select on public.alternativas to authenticated;
grant insert (questao_id, texto, correta, ordem) on public.alternativas to authenticated;
grant update (texto, correta, ordem) on public.alternativas to authenticated;
grant delete on public.alternativas to authenticated;
