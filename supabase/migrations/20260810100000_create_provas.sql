create table public.provas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null unique references public.modulos (id) on delete cascade,
  titulo text not null,
  nota_minima_ativa boolean not null default false,
  nota_minima_percentual integer,
  tentativas_limitadas boolean not null default false,
  tentativas_maximas integer,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provas_nota_minima_check check (
    (nota_minima_ativa and nota_minima_percentual between 1 and 100)
    or (not nota_minima_ativa and nota_minima_percentual is null)
  ),
  constraint provas_tentativas_check check (
    (tentativas_limitadas and tentativas_maximas > 0)
    or (not tentativas_limitadas and tentativas_maximas is null)
  )
);

alter table public.provas enable row level security;

create policy "Admins podem ver provas"
  on public.provas for select using (public.is_admin());
create policy "Admins podem criar provas"
  on public.provas for insert with check (public.is_admin());
create policy "Admins podem atualizar provas"
  on public.provas for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir provas"
  on public.provas for delete using (public.is_admin());

create trigger on_provas_updated
  before update on public.provas
  for each row execute function public.handle_updated_at();

grant select on public.provas to authenticated;
grant insert (modulo_id, titulo, nota_minima_ativa, nota_minima_percentual, tentativas_limitadas, tentativas_maximas)
  on public.provas to authenticated;
grant update (titulo, nota_minima_ativa, nota_minima_percentual, tentativas_limitadas, tentativas_maximas)
  on public.provas to authenticated;
grant delete on public.provas to authenticated;

-- Reaproveita o enum questao_tipo já existente (multipla_escolha/verdadeiro_falso/dissertativa).
create table public.questoes_prova (
  id uuid primary key default gen_random_uuid(),
  prova_id uuid not null references public.provas (id) on delete cascade,
  tipo public.questao_tipo not null,
  enunciado text not null,
  ordem integer not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questoes_prova_ordem_check check (ordem > 0)
);

create index questoes_prova_prova_id_idx on public.questoes_prova (prova_id);

alter table public.questoes_prova enable row level security;

create policy "Admins podem ver questoes_prova"
  on public.questoes_prova for select using (public.is_admin());
create policy "Admins podem criar questoes_prova"
  on public.questoes_prova for insert with check (public.is_admin());
create policy "Admins podem atualizar questoes_prova"
  on public.questoes_prova for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir questoes_prova"
  on public.questoes_prova for delete using (public.is_admin());

create trigger on_questoes_prova_updated
  before update on public.questoes_prova
  for each row execute function public.handle_updated_at();

grant select on public.questoes_prova to authenticated;
grant insert (prova_id, tipo, enunciado, ordem) on public.questoes_prova to authenticated;
grant update (tipo, enunciado, ordem) on public.questoes_prova to authenticated;
grant delete on public.questoes_prova to authenticated;

create table public.alternativas_prova (
  id uuid primary key default gen_random_uuid(),
  questao_prova_id uuid not null references public.questoes_prova (id) on delete cascade,
  texto text not null,
  correta boolean not null default false,
  ordem integer not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alternativas_prova_ordem_check check (ordem > 0)
);

create index alternativas_prova_questao_prova_id_idx on public.alternativas_prova (questao_prova_id);

alter table public.alternativas_prova enable row level security;

create policy "Admins podem ver alternativas_prova"
  on public.alternativas_prova for select using (public.is_admin());
create policy "Admins podem criar alternativas_prova"
  on public.alternativas_prova for insert with check (public.is_admin());
create policy "Admins podem atualizar alternativas_prova"
  on public.alternativas_prova for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir alternativas_prova"
  on public.alternativas_prova for delete using (public.is_admin());

create trigger on_alternativas_prova_updated
  before update on public.alternativas_prova
  for each row execute function public.handle_updated_at();

grant select on public.alternativas_prova to authenticated;
grant insert (questao_prova_id, texto, correta, ordem) on public.alternativas_prova to authenticated;
grant update (texto, correta, ordem) on public.alternativas_prova to authenticated;
grant delete on public.alternativas_prova to authenticated;
