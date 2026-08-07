-- criar_tentativa_quiz não conferia tentativas_maximas — só a Server
-- Action checava isso, então um RPC direto (bypassando a Server Action)
-- conseguia criar tentativas além do limite configurado. Move a checagem
-- pra dentro da function (fronteira de segurança real), verificada antes
-- de processar qualquer resposta — mesmo padrão das outras validações já
-- existentes aqui. A Server Action continua com a checagem também, só que
-- agora ela é conveniência de UX (mensagem amigável sem esperar o banco
-- rejeitar), não a única linha de defesa.
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

  -- Filtra por quiz_id explicitamente (não só confia na RLS de insert de
  -- respostas_quiz pra barrar questão de outro quiz — isso deixaria a nota
  -- ser calculada em cima de dado misturado antes de falhar). E confere que
  -- vieram TODAS as questões do quiz, sem duplicata — sem isso nada impede
  -- omitir uma questão difícil (ou duplicar uma fácil no lugar dela) pra
  -- inflar a nota calculando a porcentagem sobre um subconjunto menor.
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
