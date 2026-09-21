-- Comunidade do portal do aluno: fórum com categorias, posts, respostas e curtidas.
-- Configurações > Portal do Aluno > Comunidade (admin) e /aluno/comunidade (aluno).
--
-- Recurso DESLIGADO por padrão (`portal_comunidade_ativo = false`): aplicar esta migration
-- não muda nada para os alunos até o admin ligar. As policies dos alunos também exigem o
-- recurso ligado (defesa em profundidade — não depende só da UI esconder o menu).
--
-- DESVIOS CONSCIENTES do rascunho da tarefa:
--  * posts/respostas guardam o autor em `autor_id` -> profiles (não `aluno_id` -> alunos):
--    a categoria "Avisos" é postada pelo ADMIN, que não tem linha em `alunos`. Para alunos o
--    valor é o mesmo (alunos.id = profiles.id).
--  * comunidade_categorias.somente_admin: é o que faz "Avisos" ser só-leitura para alunos.
--  * curtidas: o aluno lê só as PRÓPRIAS (o que ele precisa pra saber se já curtiu; os totais
--    vêm dos contadores denormalizados). Ler "todas" exporia quem curtiu o quê.
--  * exclusão pelo aluno é SOFT (status 'removido'), não DELETE: preserva o conteúdo para
--    moderação e mantém respostas/curtidas coerentes. Categorias não têm DELETE (só desativar).
--  * contadores são RECALCULADOS (count) em trigger, não incrementados/decrementados: sem
--    deriva por corrida e se corrigem sozinhos. total_respostas conta só respostas 'ativo'.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== configuracoes =====

alter table public.configuracoes
  add column if not exists portal_comunidade_ativo boolean not null default false,
  -- true = o aluno pode excluir os próprios posts/respostas.
  add column if not exists portal_comunidade_alunos_excluem boolean not null default true;

-- `authenticated` já lê a tabela inteira (aluno lê as flags pra montar menu/telas).
grant update (portal_comunidade_ativo, portal_comunidade_alunos_excluem) on public.configuracoes to authenticated;

-- ===== helpers (security definer: usados dentro de policies) =====

create or replace function public.comunidade_ativa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.portal_comunidade_ativo from public.configuracoes c where c.id = true), false);
$$;

create or replace function public.comunidade_alunos_excluem()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.portal_comunidade_alunos_excluem from public.configuracoes c where c.id = true), true);
$$;

create or replace function public.eh_aluno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.alunos a where a.id = auth.uid());
$$;

revoke all on function public.comunidade_ativa() from public;
revoke all on function public.comunidade_alunos_excluem() from public;
revoke all on function public.eh_aluno() from public;
grant execute on function public.comunidade_ativa() to authenticated;
grant execute on function public.comunidade_alunos_excluem() to authenticated;
grant execute on function public.eh_aluno() to authenticated;

-- ===== comunidade_categorias =====

create table public.comunidade_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  descricao text check (descricao is null or char_length(descricao) <= 300),
  -- Emoji (ex.: 📢). Renderizado como texto.
  icone text check (icone is null or char_length(icone) <= 16),
  cor text not null default '#6b7280' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem integer not null default 0,
  ativo boolean not null default true,
  -- true = só o admin publica posts nesta categoria (ex.: Avisos); alunos apenas leem/respondem.
  somente_admin boolean not null default false,
  -- Nullable + set null: as categorias padrão abaixo são criadas pela migration (sem auth.uid()).
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comunidade_categorias_ordem_idx on public.comunidade_categorias (ordem);

create trigger on_comunidade_categorias_updated
  before update on public.comunidade_categorias
  for each row execute function public.handle_updated_at();

alter table public.comunidade_categorias enable row level security;

create policy "Admins gerenciam categorias da comunidade"
  on public.comunidade_categorias for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Alunos leem categorias ativas da comunidade"
  on public.comunidade_categorias for select
  using (ativo and public.comunidade_ativa() and public.eh_aluno());

grant select on public.comunidade_categorias to authenticated;
grant insert (nome, descricao, icone, cor, ordem, ativo, somente_admin) on public.comunidade_categorias to authenticated;
grant update (nome, descricao, icone, cor, ordem, ativo, somente_admin) on public.comunidade_categorias to authenticated;
grant select, insert, update, delete on public.comunidade_categorias to service_role;

-- ===== comunidade_posts =====

create table public.comunidade_posts (
  id uuid primary key default gen_random_uuid(),
  -- restrict: categoria com posts não pode ser apagada (só desativada).
  categoria_id uuid not null references public.comunidade_categorias (id) on delete restrict,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  conteudo text not null check (char_length(btrim(conteudo)) between 1 and 5000),
  fixado boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'oculto', 'removido')),
  total_respostas integer not null default 0,
  total_curtidas integer not null default 0,
  ultima_atividade_at timestamptz not null default now(),
  -- Preenchido por papel não-admin (o aluno): cascade obrigatório (CLAUDE.md).
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lista da categoria: fixados primeiro, depois por atividade.
create index comunidade_posts_categoria_idx
  on public.comunidade_posts (categoria_id, status, fixado desc, ultima_atividade_at desc);
-- Feed geral.
create index comunidade_posts_feed_idx on public.comunidade_posts (status, ultima_atividade_at desc);
create index comunidade_posts_autor_idx on public.comunidade_posts (autor_id);

create trigger on_comunidade_posts_updated
  before update on public.comunidade_posts
  for each row execute function public.handle_updated_at();

-- INSERT: quem não é admin não define fixado/status/contadores (as colunas têm grant, mas o
-- valor é forçado aqui). `auth.uid() is null` = sem sessão de usuário (service_role/migration):
-- não interfere.
create or replace function public.comunidade_posts_ao_inserir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.total_respostas := 0;
  new.total_curtidas := 0;
  new.ultima_atividade_at := now();
  if auth.uid() is not null and not public.is_admin() then
    new.fixado := false;
    new.status := 'ativo';
  end if;
  return new;
end;
$$;

create trigger comunidade_posts_ao_inserir
  before insert on public.comunidade_posts
  for each row execute function public.comunidade_posts_ao_inserir();

-- UPDATE: não-admin só pode mover o status para 'removido' (excluir o próprio post) e nunca
-- mexe em fixado. (Os UPDATEs dos contadores, feitos por funções security definer, não mudam
-- status/fixado — passam sem efeito por aqui.)
create or replace function public.comunidade_posts_ao_atualizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.fixado := old.fixado;
    if new.status <> 'removido' then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger comunidade_posts_ao_atualizar
  before update on public.comunidade_posts
  for each row execute function public.comunidade_posts_ao_atualizar();

alter table public.comunidade_posts enable row level security;

create policy "Admins veem posts da comunidade"
  on public.comunidade_posts for select using (public.is_admin());
create policy "Admins publicam posts da comunidade"
  on public.comunidade_posts for insert with check (public.is_admin() and autor_id = auth.uid());
create policy "Admins moderam posts da comunidade"
  on public.comunidade_posts for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins excluem posts da comunidade"
  on public.comunidade_posts for delete using (public.is_admin());

create policy "Alunos leem posts ativos da comunidade"
  on public.comunidade_posts for select
  using (
    status = 'ativo'
    and public.comunidade_ativa()
    and public.eh_aluno()
    and exists (select 1 from public.comunidade_categorias c where c.id = categoria_id and c.ativo)
  );

create policy "Alunos publicam posts na comunidade"
  on public.comunidade_posts for insert
  with check (
    autor_id = auth.uid()
    and public.eh_aluno()
    and public.comunidade_ativa()
    and exists (
      select 1 from public.comunidade_categorias c
      where c.id = categoria_id and c.ativo and not c.somente_admin
    )
  );

-- Excluir o PRÓPRIO post (soft delete), se o admin permitir.
create policy "Alunos excluem o proprio post da comunidade"
  on public.comunidade_posts for update
  using (autor_id = auth.uid() and status = 'ativo' and public.comunidade_alunos_excluem())
  with check (autor_id = auth.uid() and status = 'removido');

grant select on public.comunidade_posts to authenticated;
grant insert (categoria_id, autor_id, titulo, conteudo, fixado) on public.comunidade_posts to authenticated;
grant update (status, fixado) on public.comunidade_posts to authenticated;
grant delete on public.comunidade_posts to authenticated;
grant select, insert, update, delete on public.comunidade_posts to service_role;

-- ===== comunidade_respostas =====

create table public.comunidade_respostas (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.comunidade_posts (id) on delete cascade,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  conteudo text not null check (char_length(btrim(conteudo)) between 1 and 2000),
  status text not null default 'ativo' check (status in ('ativo', 'oculto', 'removido')),
  -- Não estava na lista da tarefa, mas a tela mostra curtidas por resposta.
  total_curtidas integer not null default 0,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comunidade_respostas_post_idx on public.comunidade_respostas (post_id, created_at);
create index comunidade_respostas_autor_idx on public.comunidade_respostas (autor_id);

create trigger on_comunidade_respostas_updated
  before update on public.comunidade_respostas
  for each row execute function public.handle_updated_at();

create or replace function public.comunidade_respostas_ao_inserir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.total_curtidas := 0;
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'ativo';
  end if;
  return new;
end;
$$;

create trigger comunidade_respostas_ao_inserir
  before insert on public.comunidade_respostas
  for each row execute function public.comunidade_respostas_ao_inserir();

create or replace function public.comunidade_respostas_ao_atualizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.status <> 'removido' then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger comunidade_respostas_ao_atualizar
  before update on public.comunidade_respostas
  for each row execute function public.comunidade_respostas_ao_atualizar();

-- Mantém posts.total_respostas (só respostas 'ativo') e ultima_atividade_at.
create or replace function public.comunidade_respostas_atualizar_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid;
  v_nova boolean := false;
begin
  if tg_op = 'DELETE' then
    v_post := old.post_id;
  else
    v_post := new.post_id;
    v_nova := (tg_op = 'INSERT' and new.status = 'ativo');
  end if;

  update public.comunidade_posts p
  set total_respostas = (
        select count(*) from public.comunidade_respostas r
        where r.post_id = v_post and r.status = 'ativo'
      ),
      ultima_atividade_at = case when v_nova then now() else p.ultima_atividade_at end
  where p.id = v_post;

  return null;
end;
$$;

create trigger comunidade_respostas_atualizar_post
  after insert or delete or update of status on public.comunidade_respostas
  for each row execute function public.comunidade_respostas_atualizar_post();

alter table public.comunidade_respostas enable row level security;

create policy "Admins veem respostas da comunidade"
  on public.comunidade_respostas for select using (public.is_admin());
create policy "Admins respondem na comunidade"
  on public.comunidade_respostas for insert with check (public.is_admin() and autor_id = auth.uid());
create policy "Admins moderam respostas da comunidade"
  on public.comunidade_respostas for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins excluem respostas da comunidade"
  on public.comunidade_respostas for delete using (public.is_admin());

-- A subconsulta em comunidade_posts roda com a RLS do chamador: só enxerga posts ativos de
-- categorias ativas, então responder/ler respostas exige o post estar visível.
create policy "Alunos leem respostas ativas da comunidade"
  on public.comunidade_respostas for select
  using (
    status = 'ativo'
    and public.comunidade_ativa()
    and public.eh_aluno()
    and exists (select 1 from public.comunidade_posts p where p.id = post_id)
  );

create policy "Alunos respondem na comunidade"
  on public.comunidade_respostas for insert
  with check (
    autor_id = auth.uid()
    and public.eh_aluno()
    and public.comunidade_ativa()
    and exists (select 1 from public.comunidade_posts p where p.id = post_id)
  );

create policy "Alunos excluem a propria resposta da comunidade"
  on public.comunidade_respostas for update
  using (autor_id = auth.uid() and status = 'ativo' and public.comunidade_alunos_excluem())
  with check (autor_id = auth.uid() and status = 'removido');

grant select on public.comunidade_respostas to authenticated;
grant insert (post_id, autor_id, conteudo) on public.comunidade_respostas to authenticated;
grant update (status) on public.comunidade_respostas to authenticated;
grant delete on public.comunidade_respostas to authenticated;
grant select, insert, update, delete on public.comunidade_respostas to service_role;

-- ===== comunidade_curtidas =====

create table public.comunidade_curtidas (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.comunidade_posts (id) on delete cascade,
  resposta_id uuid references public.comunidade_respostas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  -- A curtida é de um post OU de uma resposta, nunca dos dois nem de nenhum.
  check (num_nonnulls(post_id, resposta_id) = 1)
);

create unique index comunidade_curtidas_post_uidx
  on public.comunidade_curtidas (post_id, aluno_id) where post_id is not null;
create unique index comunidade_curtidas_resposta_uidx
  on public.comunidade_curtidas (resposta_id, aluno_id) where resposta_id is not null;
create index comunidade_curtidas_aluno_idx on public.comunidade_curtidas (aluno_id, created_at desc);

-- Recalcula total_curtidas do post/resposta afetado.
create or replace function public.comunidade_curtidas_atualizar_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid;
  v_resposta uuid;
begin
  if tg_op = 'DELETE' then
    v_post := old.post_id;
    v_resposta := old.resposta_id;
  else
    v_post := new.post_id;
    v_resposta := new.resposta_id;
  end if;

  if v_post is not null then
    update public.comunidade_posts p
    set total_curtidas = (select count(*) from public.comunidade_curtidas c where c.post_id = v_post)
    where p.id = v_post;
  else
    update public.comunidade_respostas r
    set total_curtidas = (select count(*) from public.comunidade_curtidas c where c.resposta_id = v_resposta)
    where r.id = v_resposta;
  end if;

  return null;
end;
$$;

create trigger comunidade_curtidas_atualizar_total
  after insert or delete on public.comunidade_curtidas
  for each row execute function public.comunidade_curtidas_atualizar_total();

alter table public.comunidade_curtidas enable row level security;

create policy "Admins veem curtidas da comunidade"
  on public.comunidade_curtidas for select using (public.is_admin());

create policy "Alunos leem as proprias curtidas"
  on public.comunidade_curtidas for select using (aluno_id = auth.uid());

-- Só curte o que está visível pra ele (post/resposta ativos, categoria ativa).
create policy "Alunos curtem na comunidade"
  on public.comunidade_curtidas for insert
  with check (
    aluno_id = auth.uid()
    and public.eh_aluno()
    and public.comunidade_ativa()
    and (
      (post_id is not null and exists (select 1 from public.comunidade_posts p where p.id = post_id))
      or (resposta_id is not null and exists (select 1 from public.comunidade_respostas r where r.id = resposta_id))
    )
  );

create policy "Alunos descurtem"
  on public.comunidade_curtidas for delete using (aluno_id = auth.uid());

grant select on public.comunidade_curtidas to authenticated;
grant insert (post_id, resposta_id, aluno_id) on public.comunidade_curtidas to authenticated;
grant delete on public.comunidade_curtidas to authenticated;
grant select, insert, update, delete on public.comunidade_curtidas to service_role;

-- ===== resumo pro painel admin =====
-- security invoker: roda com a RLS de quem chama (só o admin enxerga as tabelas inteiras;
-- para os outros os números saem 0). "Membros ativos" = alunos que postaram, responderam ou
-- curtiram nos últimos 30 dias.

create or replace function public.comunidade_resumo()
returns table (total_posts bigint, total_respostas bigint, membros_ativos bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.comunidade_posts where status = 'ativo'),
    (select count(*) from public.comunidade_respostas where status = 'ativo'),
    (select count(distinct t.autor) from (
       select autor_id as autor from public.comunidade_posts
         where status = 'ativo' and created_at >= now() - interval '30 days'
       union all
       select autor_id from public.comunidade_respostas
         where status = 'ativo' and created_at >= now() - interval '30 days'
       union all
       select aluno_id from public.comunidade_curtidas
         where created_at >= now() - interval '30 days'
     ) t
     where t.autor in (select a.id from public.alunos a));
$$;

revoke all on function public.comunidade_resumo() from public;
grant execute on function public.comunidade_resumo() to authenticated;

-- ===== categorias padrão =====
-- Só cria se a tabela estiver vazia (reexecutar a migration não duplica).

insert into public.comunidade_categorias (nome, descricao, icone, cor, ordem, somente_admin)
select v.nome, v.descricao, v.icone, v.cor, v.ordem, v.somente_admin
from (
  values
    ('Avisos', 'Comunicados oficiais da equipe.', '📢', '#ef4444', 1, true),
    ('Discussão Geral', 'Converse com os colegas sobre qualquer assunto.', '💬', '#3b82f6', 2, false),
    ('Dúvidas', 'Tire dúvidas sobre as aulas e o conteúdo.', '❓', '#f59e0b', 3, false),
    ('Conquistas e Progresso', 'Compartilhe suas conquistas e acompanhe a evolução da turma.', '🎯', '#10b981', 4, false),
    ('Sugestões', 'Ideias para melhorar a plataforma e os cursos.', '💡', '#8b5cf6', 5, false)
) as v (nome, descricao, icone, cor, ordem, somente_admin)
where not exists (select 1 from public.comunidade_categorias);
