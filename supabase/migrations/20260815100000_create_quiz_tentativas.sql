-- Quiz do aluno: tentativas + respostas, com correção automática rodando
-- em SQL (nunca confiando em nota/correta vindos do client — a function é
-- chamável via RPC direto, não só pela Server Action). Nomes no plural
-- "_quiz" (não só "tentativas"/"respostas") porque "responder prova" é
-- candidato natural a fase futura, com tentativas_prova/respostas_prova
-- separadas, mesmo padrão de duplicação já usado em questoes/questoes_prova.

create table public.tentativas_quiz (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  numero integer not null,
  nota integer not null,
  aprovado boolean not null,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  constraint tentativas_quiz_numero_check check (numero > 0),
  constraint tentativas_quiz_nota_check check (nota between 0 and 100)
);

create index tentativas_quiz_quiz_id_idx on public.tentativas_quiz (quiz_id);
create index tentativas_quiz_matricula_id_idx on public.tentativas_quiz (matricula_id);
create unique index tentativas_quiz_quiz_matricula_numero_uidx
  on public.tentativas_quiz (quiz_id, matricula_id, numero);

create table public.respostas_quiz (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_quiz (id) on delete cascade,
  questao_id uuid not null references public.questoes (id) on delete cascade,
  -- set null (não cascade): editar/excluir uma alternativa depois que
  -- alunos já responderam não deveria apagar o histórico de respostas —
  -- "correta" abaixo já congela o resultado daquele momento.
  alternativa_id uuid references public.alternativas (id) on delete set null,
  resposta_texto text,
  correta boolean, -- null = dissertativa (sem correção automática)
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create index respostas_quiz_tentativa_id_idx on public.respostas_quiz (tentativa_id);
create index respostas_quiz_questao_id_idx on public.respostas_quiz (questao_id);

alter table public.tentativas_quiz enable row level security;
alter table public.respostas_quiz enable row level security;

create policy "Admins podem ver tentativas de quiz"
  on public.tentativas_quiz for select using (public.is_admin());

create policy "Alunos podem ver suas próprias tentativas de quiz"
  on public.tentativas_quiz for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = tentativas_quiz.matricula_id and m.aluno_id = auth.uid()
    )
  );

-- Sem policy nem grant de insert aqui de propósito — nota/aprovado não
-- podem ser confiados a um insert direto do client (bypassaria a correção
-- automática). A única forma de criar uma tentativa é via
-- criar_tentativa_quiz (security definer, mais abaixo), que reimplementa
-- essas mesmas checagens de posse da matrícula + consistência do quiz
-- explicitamente no corpo da function, já que ela ignora RLS. Sem
-- update/delete pra ninguém via API — tentativa é histórico imutável, uma
-- correção "de novo" é uma tentativa nova, não uma edição.

create policy "Admins podem ver respostas de quiz"
  on public.respostas_quiz for select using (public.is_admin());

create policy "Alunos podem ver suas próprias respostas de quiz"
  on public.respostas_quiz for select
  using (
    exists (
      select 1
      from public.tentativas_quiz tq
      join public.matriculas m on m.id = tq.matricula_id
      where tq.id = respostas_quiz.tentativa_id and m.aluno_id = auth.uid()
    )
  );

-- Mesmo raciocínio: correta não pode ser confiado a um insert direto do
-- client. Sem policy nem grant de insert — só criar_tentativa_quiz escreve
-- aqui.
grant select on public.tentativas_quiz to authenticated;

grant select on public.respostas_quiz to authenticated;

-- Falta select de aluno em questoes/alternativas (só admin tinha até aqui
-- — deixado de fora de propósito na fase anterior, "conteúdo das questões
-- fica pra quando construirmos a tela de responder").
create policy "Alunos podem ver questoes de quizzes de cursos em que estão matriculados"
  on public.questoes for select
  using (
    exists (
      select 1
      from public.quizzes qz
      join public.aulas a on a.id = qz.aula_id
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where qz.id = questoes.quiz_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver alternativas de questoes de cursos em que estão matriculados"
  on public.alternativas for select
  using (
    exists (
      select 1
      from public.questoes q
      join public.quizzes qz on qz.id = q.quiz_id
      join public.aulas a on a.id = qz.aula_id
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where q.id = alternativas.questao_id and m.aluno_id = auth.uid()
    )
  );

-- Correção automática roda aqui dentro, não no Server Action — quem decide
-- o que é "correta" é sempre o banco (comparando com
-- public.alternativas.correta), nunca o valor que o client mandar. Isso
-- importa porque a function é chamável via RPC direto pelo aluno, não só
-- através da Server Action.
--
-- "security definer" (não invoker): não existe grant de insert em
-- tentativas_quiz/respostas_quiz pra authenticated — essa function é a
-- ÚNICA forma de escrever nessas tabelas, então ela roda com privilégio
-- elevado e ignora RLS. Por isso, logo no início, reimplementa
-- explicitamente as duas checagens que uma policy de insert normalmente
-- faria (posse da matrícula pelo aluno via auth.uid(), e que o quiz
-- pertence ao curso daquela matrícula) — sem RLS nesse caminho, essa
-- validação aqui dentro é a única linha de defesa, precisa ser tão
-- rigorosa quanto a policy que ela substitui.
create function public.criar_tentativa_quiz(
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

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.tentativas_quiz
  where quiz_id = p_quiz_id and matricula_id = p_matricula_id;

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

  select nota_minima_ativa, nota_minima_percentual
  into v_nota_minima_ativa, v_nota_minima_percentual
  from public.quizzes
  where id = p_quiz_id;

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

grant execute on function public.criar_tentativa_quiz(uuid, uuid, uuid[], uuid[], text[])
  to authenticated;
