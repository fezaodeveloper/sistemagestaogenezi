-- Teto diário de pontos (TAREFA 2) — aplica limite_pts_dia (já existente em
-- configuracoes desde 20260908100000_medalha_recompensas.sql, mas até aqui
-- só armazenado, nunca aplicado — decisão tomada em revisão naquela
-- migration) nas 3 functions que inserem pontos "sob demanda" do aluno
-- (marcar_aula_concluida, criar_tentativa_quiz, criar_tentativa_prova).
--
-- upsert_presencas fica de fora: é chamada só pelo admin em lote
-- (registrar presença de uma turma inteira), não pelo aluno — aplicar teto
-- ali multiplicaria o cálculo por N alunos na mesma chamada sem pedido
-- explícito da tarefa, e mudaria o comportamento de uma rotina de RH que já
-- está em produção. Só as 3 functions citadas explicitamente.
--
-- Teto é por matrícula (não por aluno) — soma pontos_eventos.pontos de HOJE
-- (created_at >= current_date) para a matrícula em questão, e cada novo
-- lançamento é reduzido (LEAST) pelo espaço restante até o teto
-- (GREATEST(0, ...) evita ponto negativo quando o teto já foi estourado).
-- Mostrar SQL — NÃO aplicar.

create or replace function public.marcar_aula_concluida(p_matricula_id uuid, p_aula_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula_concluida_id uuid;
  v_modulo_id uuid;
  v_curso_id uuid;
  v_pts_aula_concluida integer;
  v_pts_modulo_concluido integer;
  v_pts_curso_concluido integer;
  v_modulo_completo boolean;
  v_curso_completo boolean;
  v_limite_pts_dia integer;
  v_pts_hoje integer;
  v_pontos_calcular integer;
begin
  if not exists (
    select 1 from public.matriculas m
    where m.id = p_matricula_id and m.aluno_id = auth.uid()
  ) then
    raise exception 'Matrícula não encontrada ou não pertence ao usuário autenticado.';
  end if;

  select mo.id, mo.curso_id into v_modulo_id, v_curso_id
  from public.aulas a
  join public.modulos mo on mo.id = a.modulo_id
  where a.id = p_aula_id;

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

  select pts_aula_concluida, pts_modulo_concluido, pts_curso_concluido, limite_pts_dia
  into v_pts_aula_concluida, v_pts_modulo_concluido, v_pts_curso_concluido, v_limite_pts_dia
  from public.configuracoes;

  -- Teto diário — aula concluída
  select coalesce(sum(pontos), 0) into v_pts_hoje
  from public.pontos_eventos
  where matricula_id = p_matricula_id
  and created_at >= current_date;

  v_pontos_calcular := coalesce(v_pts_aula_concluida, 5);
  v_pontos_calcular := least(v_pontos_calcular, greatest(0, coalesce(v_limite_pts_dia, 100) - v_pts_hoje));

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'aula_concluida', v_pontos_calcular, p_aula_id)
  on conflict (matricula_id, tipo_evento, referencia_id) do nothing;

  select
    (select count(*) from public.aulas a where a.modulo_id = v_modulo_id) > 0
    and (select count(*) from public.aulas a where a.modulo_id = v_modulo_id) = (
      select count(distinct ac.aula_id)
      from public.aulas a
      join public.aulas_concluidas ac on ac.aula_id = a.id and ac.matricula_id = p_matricula_id
      where a.modulo_id = v_modulo_id
    )
  into v_modulo_completo;

  if v_modulo_completo then
    -- Teto diário — módulo concluído
    select coalesce(sum(pontos), 0) into v_pts_hoje
    from public.pontos_eventos
    where matricula_id = p_matricula_id
    and created_at >= current_date;

    v_pontos_calcular := coalesce(v_pts_modulo_concluido, 50);
    v_pontos_calcular := least(v_pontos_calcular, greatest(0, coalesce(v_limite_pts_dia, 100) - v_pts_hoje));

    insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
    values (p_matricula_id, 'modulo_concluido', v_pontos_calcular, v_modulo_id)
    on conflict (matricula_id, tipo_evento, referencia_id) do nothing;

    select not exists (
      select 1
      from public.modulos mo
      where mo.curso_id = v_curso_id
        and (
          (select count(*) from public.aulas a where a.modulo_id = mo.id) = 0
          or (select count(*) from public.aulas a where a.modulo_id = mo.id) > (
            select count(distinct ac.aula_id)
            from public.aulas a
            join public.aulas_concluidas ac on ac.aula_id = a.id and ac.matricula_id = p_matricula_id
            where a.modulo_id = mo.id
          )
        )
    ) into v_curso_completo;

    if v_curso_completo then
      -- Teto diário — curso concluído
      select coalesce(sum(pontos), 0) into v_pts_hoje
      from public.pontos_eventos
      where matricula_id = p_matricula_id
      and created_at >= current_date;

      v_pontos_calcular := coalesce(v_pts_curso_concluido, 200);
      v_pontos_calcular := least(v_pontos_calcular, greatest(0, coalesce(v_limite_pts_dia, 100) - v_pts_hoje));

      insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
      values (p_matricula_id, 'curso_concluido', v_pontos_calcular, v_curso_id)
      on conflict (matricula_id, tipo_evento, referencia_id) do nothing;
    end if;
  end if;
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
  v_pts_quiz_concluido integer;
  v_limite_pts_dia integer;
  v_pts_hoje integer;
  v_pontos_calcular integer;
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

  select pts_quiz_concluido, limite_pts_dia into v_pts_quiz_concluido, v_limite_pts_dia from public.configuracoes;

  v_pontos_calcular := round(v_nota * coalesce(v_pts_quiz_concluido, 20) / 100.0);

  -- Teto diário
  select coalesce(sum(pontos), 0) into v_pts_hoje
  from public.pontos_eventos
  where matricula_id = p_matricula_id
  and created_at >= current_date;

  v_pontos_calcular := least(v_pontos_calcular, greatest(0, coalesce(v_limite_pts_dia, 100) - v_pts_hoje));

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'quiz', v_pontos_calcular, p_quiz_id)
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = greatest(pontos_eventos.pontos, excluded.pontos);

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
  v_pts_nota_maxima integer;
  v_limite_pts_dia integer;
  v_pts_hoje integer;
  v_pontos_calcular integer;
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

  select pts_nota_maxima, limite_pts_dia into v_pts_nota_maxima, v_limite_pts_dia from public.configuracoes;

  v_pontos_calcular := round(v_nota * coalesce(v_pts_nota_maxima, 40) / 100.0);

  -- Teto diário
  select coalesce(sum(pontos), 0) into v_pts_hoje
  from public.pontos_eventos
  where matricula_id = p_matricula_id
  and created_at >= current_date;

  v_pontos_calcular := least(v_pontos_calcular, greatest(0, coalesce(v_limite_pts_dia, 100) - v_pts_hoje));

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'prova', v_pontos_calcular, p_prova_id)
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = greatest(pontos_eventos.pontos, excluded.pontos);

  return v_tentativa_id;
end;
$$;
