-- Fase 8: Gamificação — parte 2 (avatares, badges/medalhas, streak).

-- ============================================================
-- AVATARES
-- ============================================================

alter table public.profiles
  add column avatar_id text not null default 'raposa'
  constraint profiles_avatar_id_check check (
    avatar_id in (
      'raposa', 'coruja', 'gato', 'urso', 'panda',
      'coelho', 'tigre', 'pinguim', 'polvo', 'coala'
    )
  );

grant update (avatar_id) on public.profiles to authenticated;

-- ============================================================
-- BADGES: catálogo (fixo, seed nesta migration; sem grant de escrita)
-- ============================================================

create table public.badges (
  id text primary key,
  nome text not null,
  descricao text not null,
  icone text not null,
  ordem integer not null,
  created_at timestamptz not null default now()
);

alter table public.badges enable row level security;

create policy "Todos autenticados podem ver badges"
  on public.badges for select using (true);

grant select on public.badges to authenticated;

insert into public.badges (id, nome, descricao, icone, ordem) values
  ('primeira_aula', 'Primeira Aula', 'Concluiu a primeira aula de um curso.', '🎯', 1),
  ('modulo_completo', 'Módulo Completo', 'Concluiu todas as aulas de um módulo.', '📚', 2),
  ('curso_concluido', 'Curso Concluído', 'Concluiu todos os módulos de um curso.', '🎓', 3),
  ('nota_maxima', 'Nota Máxima', 'Tirou 100% em um quiz ou prova.', '💯', 4),
  ('presenca_exemplar', 'Presença Exemplar', '100% de presença em um módulo inteiro.', '✅', 5),
  ('top10', 'Top 10', 'Esteve entre os 10 primeiros do ranking geral.', '🏆', 6);

-- ============================================================
-- BADGES: conquistas por aluno (agrega todas as matrículas do aluno,
-- mesmo raciocínio de getCursoProgresso — conclusão em qualquer
-- matrícula conta). Zero grant de escrita: só
-- verificar_conquistas_aluno (security definer) escreve aqui.
-- ============================================================

create table public.badges_conquistados (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id) on delete cascade,
  conquistado_em timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid()
);

create index badges_conquistados_aluno_id_idx on public.badges_conquistados (aluno_id);
create index badges_conquistados_badge_id_idx on public.badges_conquistados (badge_id);
create unique index badges_conquistados_aluno_badge_uidx
  on public.badges_conquistados (aluno_id, badge_id);

alter table public.badges_conquistados enable row level security;

create policy "Admins podem ver badges conquistados"
  on public.badges_conquistados for select using (public.is_admin());

create policy "Alunos podem ver seus próprios badges"
  on public.badges_conquistados for select using (aluno_id = auth.uid());

grant select on public.badges_conquistados to authenticated;

-- View pública (mesmo padrão de ranking_geral — plain view, não
-- security_invoker — pra mostrar badge de QUALQUER aluno no ranking sem
-- abrir a RLS de badges_conquistados).
create view public.badges_publicos as
select
  bc.aluno_id,
  bc.badge_id,
  b.nome,
  b.icone,
  b.ordem,
  bc.conquistado_em
from public.badges_conquistados bc
join public.badges b on b.id = bc.badge_id;

grant select on public.badges_publicos to authenticated;

-- ============================================================
-- ranking_geral ganha avatar_id — sempre no FINAL da lista de colunas
-- (create or replace view não permite reordenar/remover colunas
-- existentes, só adicionar no fim).
-- ============================================================

create or replace view public.ranking_geral as
select
  p.id as aluno_id,
  p.full_name,
  sum(pe.pontos) as total_pontos,
  p.avatar_id
from public.pontos_eventos pe
join public.matriculas m on m.id = pe.matricula_id
join public.turmas t on t.id = m.turma_id
join public.cursos c on c.id = t.curso_id
join public.profiles p on p.id = m.aluno_id
where c.tipo <> 'ead' or (select ead_participa_gamificacao from public.configuracoes)
group by p.id, p.full_name, p.avatar_id;

-- ============================================================
-- STREAK: calculado sob demanda, não armazenado. Sessões consecutivas
-- (por data de presença, combinando todas as matrículas
-- presenciais/híbridas do aluno) sem falta/reposição.
-- security definer: hoje não existe nenhuma policy de select de aluno em
-- presencas (só admin) — reimplementa a checagem de posse, mesmo padrão
-- de marcar_aula_concluida.
-- ============================================================

create function public.calcular_streak_aluno(p_aluno_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_streak integer;
begin
  if p_aluno_id <> auth.uid() and not public.is_admin() then
    raise exception 'Você não tem permissão para ver o streak deste aluno.';
  end if;

  with historico as (
    select
      p.status,
      row_number() over (order by p.data desc) as posicao
    from public.presencas p
    join public.matriculas m on m.id = p.matricula_id
    join public.turmas t on t.id = m.turma_id
    join public.cursos c on c.id = t.curso_id
    where m.aluno_id = p_aluno_id
      and c.tipo <> 'ead'
  ),
  primeira_quebra as (
    select min(posicao) as posicao
    from historico
    where status not in ('presente', 'justificada')
  )
  select coalesce(
    (select posicao - 1 from primeira_quebra),
    (select count(*) from historico)
  ) into v_streak;

  return v_streak;
end;
$$;

grant execute on function public.calcular_streak_aluno(uuid) to authenticated;

-- ============================================================
-- BADGES: function central de verificação/concessão — chamada a partir
-- de upsert_presencas, marcar_aula_concluida, criar_tentativa_quiz e
-- criar_tentativa_prova (as mesmas 4 que lançam pontos). Sem grant pra
-- authenticated: só alcançável internamente por essas 4. Recalcula do
-- zero a cada chamada (idempotente via on conflict do nothing) — sem
-- estado incremental pra manter sincronizado.
-- ============================================================

create function public.verificar_conquistas_aluno(p_aluno_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meu_total integer;
  v_colocacao integer;
begin
  -- 1. Primeira Aula
  insert into public.badges_conquistados (aluno_id, badge_id)
  select p_aluno_id, 'primeira_aula'
  where exists (
    select 1
    from public.aulas_concluidas ac
    join public.matriculas m on m.id = ac.matricula_id
    where m.aluno_id = p_aluno_id
  )
  on conflict (aluno_id, badge_id) do nothing;

  -- 2. Módulo Completo
  insert into public.badges_conquistados (aluno_id, badge_id)
  select p_aluno_id, 'modulo_completo'
  where exists (
    select 1
    from public.modulos mo
    where mo.curso_id in (
      select t.curso_id
      from public.matriculas m
      join public.turmas t on t.id = m.turma_id
      where m.aluno_id = p_aluno_id
    )
    and (select count(*) from public.aulas a where a.modulo_id = mo.id) > 0
    and (select count(*) from public.aulas a where a.modulo_id = mo.id) = (
      select count(distinct a.id)
      from public.aulas a
      join public.aulas_concluidas ac on ac.aula_id = a.id
      join public.matriculas m2 on m2.id = ac.matricula_id
      where a.modulo_id = mo.id and m2.aluno_id = p_aluno_id
    )
  )
  on conflict (aluno_id, badge_id) do nothing;

  -- 3. Curso Concluído
  insert into public.badges_conquistados (aluno_id, badge_id)
  select p_aluno_id, 'curso_concluido'
  where exists (
    select 1
    from public.cursos c
    where c.id in (
      select t.curso_id
      from public.matriculas m
      join public.turmas t on t.id = m.turma_id
      where m.aluno_id = p_aluno_id
    )
    and (select count(*) from public.modulos mo where mo.curso_id = c.id) > 0
    and not exists (
      select 1
      from public.modulos mo
      where mo.curso_id = c.id
        and (
          (select count(*) from public.aulas a where a.modulo_id = mo.id) = 0
          or (select count(*) from public.aulas a where a.modulo_id = mo.id) > (
            select count(distinct a.id)
            from public.aulas a
            join public.aulas_concluidas ac on ac.aula_id = a.id
            join public.matriculas m2 on m2.id = ac.matricula_id
            where a.modulo_id = mo.id and m2.aluno_id = p_aluno_id
          )
        )
    )
  )
  on conflict (aluno_id, badge_id) do nothing;

  -- 4. Nota Máxima
  insert into public.badges_conquistados (aluno_id, badge_id)
  select p_aluno_id, 'nota_maxima'
  where exists (
    select 1 from public.tentativas_quiz tq
    join public.matriculas m on m.id = tq.matricula_id
    where m.aluno_id = p_aluno_id and tq.nota = 100
  ) or exists (
    select 1 from public.tentativas_prova tp
    join public.matriculas m on m.id = tp.matricula_id
    where m.aluno_id = p_aluno_id and tp.nota = 100
  )
  on conflict (aluno_id, badge_id) do nothing;

  -- 5. Presença Exemplar (só presencial/híbrido; 100% = status 'presente')
  insert into public.badges_conquistados (aluno_id, badge_id)
  select p_aluno_id, 'presenca_exemplar'
  where exists (
    select 1
    from public.modulos mo
    join public.cursos c on c.id = mo.curso_id
    where c.tipo <> 'ead'
      and c.id in (
        select t.curso_id
        from public.matriculas m
        join public.turmas t on t.id = m.turma_id
        where m.aluno_id = p_aluno_id
      )
      and (select count(*) from public.aulas a where a.modulo_id = mo.id) > 0
      and (select count(*) from public.aulas a where a.modulo_id = mo.id) = (
        select count(distinct a.id)
        from public.aulas a
        join public.presencas p on p.aula_id = a.id
        join public.matriculas m2 on m2.id = p.matricula_id
        where a.modulo_id = mo.id and m2.aluno_id = p_aluno_id and p.status = 'presente'
      )
  )
  on conflict (aluno_id, badge_id) do nothing;

  -- 6. Top 10 (permanente uma vez conquistado; ver limitação documentada
  -- no plano sobre mudanças de rank causadas só por terceiros)
  select total_pontos into v_meu_total
  from public.ranking_geral
  where aluno_id = p_aluno_id;

  if v_meu_total is not null then
    select count(*) into v_colocacao
    from public.ranking_geral
    where total_pontos > v_meu_total;

    if v_colocacao < 10 then
      insert into public.badges_conquistados (aluno_id, badge_id)
      values (p_aluno_id, 'top10')
      on conflict (aluno_id, badge_id) do nothing;
    end if;
  end if;
end;
$$;

-- ============================================================
-- Acrescenta a chamada a verificar_conquistas_aluno no final de cada
-- uma das 4 functions que já lançam pontos. Corpo idêntico ao da
-- migration anterior (20260821100000), só com o "perform" adicionado.
-- ============================================================

create or replace function public.upsert_presencas(
  p_matricula_ids uuid[],
  p_aula_id uuid,
  p_data date,
  p_statuses public.presenca_status[],
  p_data_reposicoes date[],
  p_justificativas text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso_tipo public.curso_tipo;
  v_aluno_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar presenças.';
  end if;

  select c.tipo into v_curso_tipo
  from public.aulas a
  join public.modulos mo on mo.id = a.modulo_id
  join public.cursos c on c.id = mo.curso_id
  where a.id = p_aula_id;

  with presencas_upsert as (
    insert into public.presencas (matricula_id, aula_id, data, status, data_reposicao, justificativa)
    select matricula_id, p_aula_id, p_data, status, data_reposicao, justificativa
    from unnest(p_matricula_ids, p_statuses, p_data_reposicoes, p_justificativas)
      as t (matricula_id, status, data_reposicao, justificativa)
    on conflict (matricula_id, aula_id, data)
    do update set
      status = excluded.status,
      data_reposicao = excluded.data_reposicao,
      justificativa = excluded.justificativa
    returning id, matricula_id, status
  )
  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  select
    pu.matricula_id,
    'presenca',
    case
      when v_curso_tipo = 'ead' then 0
      when pu.status = 'presente' then 10
      when pu.status = 'justificada' then 5
      else 0
    end,
    pu.id
  from presencas_upsert pu
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = excluded.pontos;

  for v_aluno_id in
    select distinct m.aluno_id
    from public.matriculas m
    where m.id = any(p_matricula_ids)
  loop
    perform public.verificar_conquistas_aluno(v_aluno_id);
  end loop;
end;
$$;

create or replace function public.marcar_aula_concluida(p_matricula_id uuid, p_aula_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula_concluida_id uuid;
begin
  if not exists (
    select 1 from public.matriculas m
    where m.id = p_matricula_id and m.aluno_id = auth.uid()
  ) then
    raise exception 'Matrícula não encontrada ou não pertence ao usuário autenticado.';
  end if;

  if not exists (
    select 1
    from public.aulas a
    join public.modulos mo on mo.id = a.modulo_id
    join public.turmas t on t.curso_id = mo.curso_id
    join public.matriculas m on m.turma_id = t.id
    where a.id = p_aula_id and m.id = p_matricula_id
  ) then
    raise exception 'Esta aula não pertence ao curso da matrícula informada.';
  end if;

  if public.matricula_expirada(p_matricula_id) then
    raise exception 'Sua matrícula expirou. Fale com a administração para renovar o acesso.';
  end if;

  if not public.aula_liberada_para_matricula(p_matricula_id, p_aula_id) then
    raise exception 'Esta aula ainda não está liberada.';
  end if;

  insert into public.aulas_concluidas (matricula_id, aula_id)
  values (p_matricula_id, p_aula_id)
  on conflict (matricula_id, aula_id) do nothing
  returning id into v_aula_concluida_id;

  if v_aula_concluida_id is null then
    return;
  end if;

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'aula_concluida', 5, p_aula_id)
  on conflict (matricula_id, tipo_evento, referencia_id) do nothing;

  perform public.verificar_conquistas_aluno(
    (select aluno_id from public.matriculas where id = p_matricula_id)
  );
end;
$$;

create or replace function public.criar_tentativa_quiz(
  p_quiz_id uuid,
  p_matricula_id uuid,
  p_questao_ids uuid[],
  p_alternativa_ids uuid[],
  p_textos text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
  v_tentativa_id uuid;
  v_total_objetivas integer;
  v_corretas_count integer;
  v_nota integer;
  v_nota_minima_ativa boolean;
  v_nota_minima_percentual integer;
  v_tentativas_limitadas boolean;
  v_tentativas_maximas integer;
  v_aprovado boolean;
  v_questoes_esperadas integer;
  v_questoes_recebidas integer;
  v_questoes_recebidas_distintas integer;
begin
  if not exists (
    select 1 from public.matriculas m
    where m.id = p_matricula_id and m.aluno_id = auth.uid()
  ) then
    raise exception 'Matrícula não encontrada ou não pertence ao usuário autenticado.';
  end if;

  if public.matricula_expirada(p_matricula_id) then
    raise exception 'Sua matrícula expirou. Fale com a administração para renovar o acesso.';
  end if;

  if not exists (
    select 1
    from public.quizzes qz
    join public.aulas a on a.id = qz.aula_id
    join public.modulos mo on mo.id = a.modulo_id
    join public.turmas t on t.curso_id = mo.curso_id
    join public.matriculas m on m.turma_id = t.id
    where qz.id = p_quiz_id and m.id = p_matricula_id
  ) then
    raise exception 'Este quiz não pertence ao curso da matrícula informada.';
  end if;

  select nota_minima_ativa, nota_minima_percentual, tentativas_limitadas, tentativas_maximas
  into v_nota_minima_ativa, v_nota_minima_percentual, v_tentativas_limitadas, v_tentativas_maximas
  from public.quizzes
  where id = p_quiz_id;

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.tentativas_quiz
  where quiz_id = p_quiz_id and matricula_id = p_matricula_id;

  if v_tentativas_limitadas and v_numero > v_tentativas_maximas then
    raise exception 'Você atingiu o limite de tentativas para este quiz.';
  end if;

  select count(*) into v_questoes_esperadas
  from public.questoes
  where quiz_id = p_quiz_id;

  create temporary table tmp_respostas_quiz on commit drop as
  select
    t.qid as questao_id,
    t.aid as alternativa_id,
    t.txt as resposta_texto,
    q.tipo,
    case
      when q.tipo = 'dissertativa' then null
      else exists (
        select 1 from public.alternativas alt
        where alt.id = t.aid and alt.questao_id = t.qid and alt.correta = true
      )
    end as correta
  from unnest(p_questao_ids, p_alternativa_ids, p_textos) as t (qid, aid, txt)
  join public.questoes q on q.id = t.qid and q.quiz_id = p_quiz_id;

  select count(*), count(distinct questao_id)
  into v_questoes_recebidas, v_questoes_recebidas_distintas
  from tmp_respostas_quiz;

  if v_questoes_recebidas <> v_questoes_esperadas
    or v_questoes_recebidas_distintas <> v_questoes_esperadas then
    raise exception 'É necessário responder todas as questões deste quiz, sem repetição.';
  end if;

  select
    count(*) filter (where tipo <> 'dissertativa'),
    count(*) filter (where correta = true)
  into v_total_objetivas, v_corretas_count
  from tmp_respostas_quiz;

  v_nota := case
    when v_total_objetivas > 0 then round(100.0 * v_corretas_count / v_total_objetivas)
    else 0
  end;

  v_aprovado := (not v_nota_minima_ativa) or (v_nota >= v_nota_minima_percentual);

  insert into public.tentativas_quiz (quiz_id, matricula_id, numero, nota, aprovado)
  values (p_quiz_id, p_matricula_id, v_numero, v_nota, v_aprovado)
  returning id into v_tentativa_id;

  insert into public.respostas_quiz (tentativa_id, questao_id, alternativa_id, resposta_texto, correta)
  select v_tentativa_id, questao_id, alternativa_id, resposta_texto, correta
  from tmp_respostas_quiz;

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'quiz', round(v_nota * 20.0 / 100), p_quiz_id)
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = greatest(pontos_eventos.pontos, excluded.pontos);

  perform public.verificar_conquistas_aluno(
    (select aluno_id from public.matriculas where id = p_matricula_id)
  );

  return v_tentativa_id;
end;
$$;

create or replace function public.criar_tentativa_prova(
  p_prova_id uuid,
  p_matricula_id uuid,
  p_questao_ids uuid[],
  p_alternativa_ids uuid[],
  p_textos text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
  v_tentativa_id uuid;
  v_total_objetivas integer;
  v_corretas_count integer;
  v_nota integer;
  v_nota_minima_ativa boolean;
  v_nota_minima_percentual integer;
  v_tentativas_limitadas boolean;
  v_tentativas_maximas integer;
  v_aprovado boolean;
  v_questoes_esperadas integer;
  v_questoes_recebidas integer;
  v_questoes_recebidas_distintas integer;
begin
  if not exists (
    select 1 from public.matriculas m
    where m.id = p_matricula_id and m.aluno_id = auth.uid()
  ) then
    raise exception 'Matrícula não encontrada ou não pertence ao usuário autenticado.';
  end if;

  if public.matricula_expirada(p_matricula_id) then
    raise exception 'Sua matrícula expirou. Fale com a administração para renovar o acesso.';
  end if;

  if not exists (
    select 1
    from public.provas pv
    join public.modulos mo on mo.id = pv.modulo_id
    join public.turmas t on t.curso_id = mo.curso_id
    join public.matriculas m on m.turma_id = t.id
    where pv.id = p_prova_id and m.id = p_matricula_id
  ) then
    raise exception 'Esta prova não pertence ao curso da matrícula informada.';
  end if;

  select nota_minima_ativa, nota_minima_percentual, tentativas_limitadas, tentativas_maximas
  into v_nota_minima_ativa, v_nota_minima_percentual, v_tentativas_limitadas, v_tentativas_maximas
  from public.provas
  where id = p_prova_id;

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.tentativas_prova
  where prova_id = p_prova_id and matricula_id = p_matricula_id;

  if v_tentativas_limitadas and v_numero > v_tentativas_maximas then
    raise exception 'Você atingiu o limite de tentativas para esta prova.';
  end if;

  select count(*) into v_questoes_esperadas
  from public.questoes_prova
  where prova_id = p_prova_id;

  create temporary table tmp_respostas_prova on commit drop as
  select
    t.qid as questao_prova_id,
    t.aid as alternativa_prova_id,
    t.txt as resposta_texto,
    q.tipo,
    case
      when q.tipo = 'dissertativa' then null
      else exists (
        select 1 from public.alternativas_prova alt
        where alt.id = t.aid and alt.questao_prova_id = t.qid and alt.correta = true
      )
    end as correta
  from unnest(p_questao_ids, p_alternativa_ids, p_textos) as t (qid, aid, txt)
  join public.questoes_prova q on q.id = t.qid and q.prova_id = p_prova_id;

  select count(*), count(distinct questao_prova_id)
  into v_questoes_recebidas, v_questoes_recebidas_distintas
  from tmp_respostas_prova;

  if v_questoes_recebidas <> v_questoes_esperadas
    or v_questoes_recebidas_distintas <> v_questoes_esperadas then
    raise exception 'É necessário responder todas as questões desta prova, sem repetição.';
  end if;

  select
    count(*) filter (where tipo <> 'dissertativa'),
    count(*) filter (where correta = true)
  into v_total_objetivas, v_corretas_count
  from tmp_respostas_prova;

  v_nota := case
    when v_total_objetivas > 0 then round(100.0 * v_corretas_count / v_total_objetivas)
    else 0
  end;

  v_aprovado := (not v_nota_minima_ativa) or (v_nota >= v_nota_minima_percentual);

  insert into public.tentativas_prova (prova_id, matricula_id, numero, nota, aprovado)
  values (p_prova_id, p_matricula_id, v_numero, v_nota, v_aprovado)
  returning id into v_tentativa_id;

  insert into public.respostas_prova (tentativa_id, questao_prova_id, alternativa_prova_id, resposta_texto, correta)
  select v_tentativa_id, questao_prova_id, alternativa_prova_id, resposta_texto, correta
  from tmp_respostas_prova;

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'prova', round(v_nota * 40.0 / 100), p_prova_id)
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = greatest(pontos_eventos.pontos, excluded.pontos);

  perform public.verificar_conquistas_aluno(
    (select aluno_id from public.matriculas where id = p_matricula_id)
  );

  return v_tentativa_id;
end;
$$;
