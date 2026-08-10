-- Prazo de validade da matrícula (fase de cronograma, parte 5). Toda
-- matrícula tem uma data de expiração — por padrão turma.data_inicio + 1
-- ano, calculada via trigger (não dá pra usar um "default" de coluna
-- simples, já que depende de outra tabela). Admin pode sobrescrever
-- manualmente por matrícula.
alter table public.matriculas add column data_expiracao date;

-- Backfill das matrículas já existentes, antes de travar not null.
update public.matriculas m
set data_expiracao = (t.data_inicio + interval '1 year')::date
from public.turmas t
where t.id = m.turma_id;

alter table public.matriculas alter column data_expiracao set not null;

-- Só preenche quando data_expiracao vier null no insert — permite tanto o
-- caminho comum (Server Action não informa nada, banco calcula sozinho)
-- quanto uma eventual criação já com data customizada, sem mudar o
-- trigger.
create function public.calcular_data_expiracao_matricula()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.data_expiracao is null then
    select (t.data_inicio + interval '1 year')::date
    into new.data_expiracao
    from public.turmas t
    where t.id = new.turma_id;
  end if;
  return new;
end;
$$;

create trigger before_matricula_insert_calcular_expiracao
  before insert on public.matriculas
  for each row execute function public.calcular_data_expiracao_matricula();

grant insert (data_expiracao) on public.matriculas to authenticated;
grant update (data_expiracao) on public.matriculas to authenticated;

-- Booleano reutilizado em três lugares: RLS de aulas_concluidas,
-- criar_tentativa_quiz e criar_tentativa_prova. security invoker — RLS de
-- matriculas já permite tanto admin quanto o próprio aluno lerem a linha
-- relevante.
create function public.matricula_expirada(p_matricula_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select coalesce(
    (select data_expiracao < current_date from public.matriculas where id = p_matricula_id),
    false
  );
$$;

grant execute on function public.matricula_expirada(uuid) to authenticated;

-- Expiração é absoluta: sobrepõe até liberação manual (Parte 4). Por isso
-- entra como mais uma condição AND, separada de aula_liberada_para_matricula
-- (que continua só sobre calendário/sequência/liberação manual).
drop policy "Alunos podem marcar suas próprias aulas concluídas" on public.aulas_concluidas;

create policy "Alunos podem marcar suas próprias aulas concluídas"
  on public.aulas_concluidas for insert
  with check (
    exists (
      select 1 from public.matriculas m
      where m.id = aulas_concluidas.matricula_id and m.aluno_id = auth.uid()
    )
    and exists (
      select 1
      from public.aulas a
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where a.id = aulas_concluidas.aula_id and m.id = aulas_concluidas.matricula_id
    )
    and public.aula_liberada_para_matricula(aulas_concluidas.matricula_id, aulas_concluidas.aula_id)
    and not public.matricula_expirada(aulas_concluidas.matricula_id)
  );

-- criar_tentativa_quiz: mesma assinatura, só adiciona a checagem de
-- expiração logo após confirmar posse da matrícula (mesmo padrão já usado
-- ali pra tentativas_maximas).
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

  return v_tentativa_id;
end;
$$;

-- criar_tentativa_prova: mesma mudança, espelhada.
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

  return v_tentativa_id;
end;
$$;
