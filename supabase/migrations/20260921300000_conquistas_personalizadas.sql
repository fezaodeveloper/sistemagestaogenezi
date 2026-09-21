-- Conquistas PERSONALIZADAS do portal do aluno (Configurações > Portal do Aluno > Gamificação
-- e /aluno/conquistas): o admin cria conquistas com gatilho + badge (emoji ou imagem) e o
-- sistema as desbloqueia sozinho.
--
-- ===== O QUE JÁ EXISTIA (verificado antes de escrever) — e por que os nomes abaixo =====
--  * public.verificar_conquistas_aluno(uuid) JÁ EXISTE (20260822100000): retorna void, concede
--    os 6 badges fixos (tabela `badges`/`badges_conquistados`) e é chamada por
--    upsert_presencas/criar_tentativa_quiz/criar_tentativa_prova. Recriá-la com outro retorno
--    é impossível (create or replace não muda o tipo) e trocar o corpo quebraria os 4 chamadores.
--    Por isso a função NOVA se chama verificar_conquistas_personalizadas e a antiga NÃO é tocada.
--  * marcar_aula_concluida foi reescrita 4 vezes (a última em 20260916700000, que já perdeu a
--    chamada à função antiga). NÃO é recriada aqui: o gancho é um TRIGGER em pontos_eventos —
--    todas as versões da função sempre inserem uma linha em pontos_eventos ao concluir a aula
--    (com 0 pontos se houver teto diário/inadimplência), então o trigger cobre aula concluída,
--    quiz, prova, presença, bônus de medalha etc. sem reescrever nenhuma dessas funções.
--  * badges, badges_conquistados, badges_publicos: sistema de MEDALHAS (ranking/recompensas).
--    Continua intacto e independente; as tabelas novas são `conquistas` e `aluno_conquistas`.
--
-- Desligado por padrão (`portal_conquistas_ativo = false`): aplicar a migration não muda nada.
-- Com o recurso desligado a função não desbloqueia nada.
--
-- Gatilhos que NÃO dependem de trigger (chamados pelo app, ver src/lib/conquistas/verificar.ts):
-- certificado emitido e comentário aprovado (a tabela aula_comentarios pode nem existir ainda
-- neste banco — por isso a função a consulta via SQL dinâmico protegido por to_regclass).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== configuracoes =====

alter table public.configuracoes
  add column if not exists portal_conquistas_ativo boolean not null default false;

grant update (portal_conquistas_ativo) on public.configuracoes to authenticated;

-- ===== conquistas (catálogo, gerenciado pelo admin) =====

create table public.conquistas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 60),
  -- Exibida no modal de celebração.
  descricao text check (descricao is null or char_length(descricao) <= 300),
  gatilho text not null check (
    gatilho in (
      'primeira_aula', 'n_aulas', 'percentual_curso', 'curso_completo',
      'primeiro_comentario', 'certificado_emitido', 'n_pontos'
    )
  ),
  -- N (n_aulas), % (percentual_curso) ou pontos (n_pontos). Nos demais gatilhos fica nulo.
  gatilho_valor integer,
  -- Imagem personalizada (URL pública do bucket conquistas-badges) OU emoji.
  badge_url text,
  badge_emoji text check (badge_emoji is null or char_length(badge_emoji) <= 16),
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conquistas_gatilho_valor_check check (
    (gatilho in ('n_aulas', 'n_pontos') and gatilho_valor is not null and gatilho_valor >= 1)
    or (gatilho = 'percentual_curso' and gatilho_valor between 1 and 100)
    or gatilho in ('primeira_aula', 'curso_completo', 'primeiro_comentario', 'certificado_emitido')
  )
);

create index conquistas_ativo_ordem_idx on public.conquistas (ativo, ordem, created_at);

create trigger on_conquistas_updated
  before update on public.conquistas
  for each row execute function public.handle_updated_at();

alter table public.conquistas enable row level security;

create policy "Admins gerenciam conquistas"
  on public.conquistas for all
  using (public.is_admin())
  with check (public.is_admin());

-- O aluno vê as conquistas ativas (as bloqueadas aparecem cinza com cadeado), e só com o
-- recurso ligado.
create policy "Alunos leem conquistas ativas"
  on public.conquistas for select
  using (
    ativo
    and exists (select 1 from public.configuracoes c where c.id = true and c.portal_conquistas_ativo)
  );

grant select on public.conquistas to authenticated;
grant insert (titulo, descricao, gatilho, gatilho_valor, badge_url, badge_emoji, ativo, ordem)
  on public.conquistas to authenticated;
grant update (titulo, descricao, gatilho, gatilho_valor, badge_url, badge_emoji, ativo, ordem)
  on public.conquistas to authenticated;
grant delete on public.conquistas to authenticated;
grant select, insert, update, delete on public.conquistas to service_role;

-- ===== aluno_conquistas (o que cada aluno já desbloqueou) =====

create table public.aluno_conquistas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  conquista_id uuid not null references public.conquistas (id) on delete cascade,
  desbloqueada_em timestamptz not null default now(),
  -- Quando o aluno viu o modal de celebração (nulo = ainda não viu). Fica no banco (e não em
  -- localStorage) para o modal não repetir em outro aparelho.
  notificada_em timestamptz,
  -- Escrita só pela função security definer (que passa o próprio aluno). Cascade obrigatório
  -- (CLAUDE.md): o valor aponta para a conta do aluno, excluída rotineiramente.
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  constraint aluno_conquistas_aluno_conquista_uniq unique (aluno_id, conquista_id)
);

create index aluno_conquistas_conquista_idx on public.aluno_conquistas (conquista_id);
create index aluno_conquistas_pendentes_idx on public.aluno_conquistas (aluno_id) where notificada_em is null;

alter table public.aluno_conquistas enable row level security;

create policy "Admins veem conquistas desbloqueadas"
  on public.aluno_conquistas for select using (public.is_admin());

create policy "Alunos veem as proprias conquistas"
  on public.aluno_conquistas for select using (aluno_id = auth.uid());

-- O aluno só marca "vi o modal" nas próprias linhas (e só essa coluna tem grant).
create policy "Alunos marcam as proprias conquistas como vistas"
  on public.aluno_conquistas for update
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

-- Sem grant de insert/delete pra authenticated: só a função security definer desbloqueia.
grant select on public.aluno_conquistas to authenticated;
grant update (notificada_em) on public.aluno_conquistas to authenticated;
grant select, insert, update, delete on public.aluno_conquistas to service_role;

-- ===== avaliação (núcleo) =====
-- Recalcula do zero a cada chamada e é idempotente (on conflict do nothing): não há estado
-- incremental pra manter sincronizado. As métricas agregam TODAS as matrículas do aluno (mesmo
-- raciocínio dos badges existentes). Sem grant: só alcançável pelo wrapper e pelos triggers.

create or replace function public.conquistas_avaliar(p_aluno_id uuid)
returns setof public.conquistas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativo boolean;
  v_aulas integer := 0;
  v_max_pct numeric := 0;
  v_comentarios integer := 0;
  v_certificados integer := 0;
  v_pontos numeric := 0;
begin
  select c.portal_conquistas_ativo into v_ativo from public.configuracoes c where c.id = true;
  if not coalesce(v_ativo, false) then
    return;
  end if;

  -- Nada pendente pra este aluno? Sai antes de calcular as métricas.
  if not exists (
    select 1 from public.conquistas q
    where q.ativo
      and not exists (
        select 1 from public.aluno_conquistas ac
        where ac.aluno_id = p_aluno_id and ac.conquista_id = q.id
      )
  ) then
    return;
  end if;

  -- Aulas concluídas (distintas) em qualquer matrícula.
  select count(distinct ac.aula_id) into v_aulas
  from public.aulas_concluidas ac
  join public.matriculas m on m.id = ac.matricula_id
  where m.aluno_id = p_aluno_id;

  -- Maior % de conclusão entre os cursos em que já concluiu alguma aula.
  select coalesce(max(f.feitas * 100.0 / t.total), 0) into v_max_pct
  from (
    select mo.curso_id, count(distinct ac.aula_id) as feitas
    from public.aulas_concluidas ac
    join public.matriculas m on m.id = ac.matricula_id
    join public.aulas a on a.id = ac.aula_id
    join public.modulos mo on mo.id = a.modulo_id
    where m.aluno_id = p_aluno_id
    group by mo.curso_id
  ) f
  cross join lateral (
    select count(*) as total
    from public.aulas a2
    join public.modulos m2 on m2.id = a2.modulo_id
    where m2.curso_id = f.curso_id
  ) t
  where t.total > 0;

  -- aula_comentarios vem de outra migration: só consulta se a tabela existir.
  if to_regclass('public.aula_comentarios') is not null then
    execute 'select count(*) from public.aula_comentarios where aluno_id = $1 and status = ''aprovado'''
      into v_comentarios using p_aluno_id;
  end if;

  select count(*) into v_certificados
  from public.certificados c
  join public.matriculas m on m.id = c.matricula_id
  where m.aluno_id = p_aluno_id and c.status = 'emitido';

  -- Mesma fonte dos badges de pontos existentes (respeita o toggle de EAD na gamificação).
  select coalesce(sum(r.total_pontos), 0) into v_pontos
  from public.ranking_geral r
  where r.aluno_id = p_aluno_id;

  return query
  with novas as (
    insert into public.aluno_conquistas (aluno_id, conquista_id, created_by)
    select p_aluno_id, q.id, p_aluno_id
    from public.conquistas q
    where q.ativo
      and not exists (
        select 1 from public.aluno_conquistas ac
        where ac.aluno_id = p_aluno_id and ac.conquista_id = q.id
      )
      and case q.gatilho
        when 'primeira_aula' then v_aulas >= 1
        when 'n_aulas' then v_aulas >= q.gatilho_valor
        when 'percentual_curso' then v_max_pct >= q.gatilho_valor
        when 'curso_completo' then v_max_pct >= 100
        when 'primeiro_comentario' then v_comentarios >= 1
        when 'certificado_emitido' then v_certificados >= 1
        when 'n_pontos' then v_pontos >= q.gatilho_valor
        else false
      end
    on conflict (aluno_id, conquista_id) do nothing
    returning conquista_id
  )
  select q.*
  from public.conquistas q
  join novas n on n.conquista_id = q.id
  order by q.ordem, q.created_at;
end;
$$;

revoke all on function public.conquistas_avaliar(uuid) from public;

-- ===== verificar_conquistas_personalizadas (a função pedida) =====
-- Devolve as conquistas DESBLOQUEADAS AGORA (as que já estavam desbloqueadas não voltam).
-- Chamada pelo app (client admin) e utilizável pelo próprio aluno/admin; o aluno só verifica a si.

create or replace function public.verificar_conquistas_personalizadas(p_aluno_id uuid)
returns setof public.conquistas
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() nulo = service_role/servidor (sem sessão de usuário): confiável.
  if auth.uid() is not null and p_aluno_id <> auth.uid() and not public.is_admin() then
    raise exception 'Você não tem permissão para verificar as conquistas deste aluno.';
  end if;

  return query select * from public.conquistas_avaliar(p_aluno_id);
end;
$$;

revoke all on function public.verificar_conquistas_personalizadas(uuid) from public;
grant execute on function public.verificar_conquistas_personalizadas(uuid) to authenticated, service_role;

-- ===== gancho: pontos acumulados / aula concluída =====
-- Roda em toda inserção/atualização de pontos. NUNCA pode derrubar a operação de origem
-- (concluir aula, tentativa de quiz, presença em lote...): qualquer erro é engolido.

create or replace function public.trg_conquistas_apos_pontos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno uuid;
begin
  begin
    select m.aluno_id into v_aluno from public.matriculas m where m.id = new.matricula_id;
    if v_aluno is not null then
      perform public.conquistas_avaliar(v_aluno);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger conquistas_apos_pontos
  after insert or update of pontos on public.pontos_eventos
  for each row execute function public.trg_conquistas_apos_pontos();

-- ===== bucket da imagem do badge =====
-- Público (a imagem aparece pra todos os alunos), escrita só do admin, até 1 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conquistas-badges', 'conquistas-badges', true, 1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Admins enviam badges de conquistas"
  on storage.objects for insert
  with check (bucket_id = 'conquistas-badges' and public.is_admin());

create policy "Admins atualizam badges de conquistas"
  on storage.objects for update
  using (bucket_id = 'conquistas-badges' and public.is_admin());

create policy "Admins excluem badges de conquistas"
  on storage.objects for delete
  using (bucket_id = 'conquistas-badges' and public.is_admin());
