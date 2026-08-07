-- Prova do aluno: mesma lógica do quiz (tentativas + respostas com
-- correção automática em SQL), só trocando o vínculo (módulo em vez de
-- aula) e as tabelas espelhadas (questoes_prova/alternativas_prova em vez
-- de questoes/alternativas). Todas as lições de segurança da sessão do
-- quiz já aplicadas desde esta v1 — não há "versão ingênua" anterior.

create table public.tentativas_prova (
  id uuid primary key default gen_random_uuid(),
  prova_id uuid not null references public.provas (id) on delete cascade,
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  numero integer not null,
  nota integer not null,
  aprovado boolean not null,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  constraint tentativas_prova_numero_check check (numero > 0),
  constraint tentativas_prova_nota_check check (nota between 0 and 100)
);

create index tentativas_prova_prova_id_idx on public.tentativas_prova (prova_id);
create index tentativas_prova_matricula_id_idx on public.tentativas_prova (matricula_id);
create unique index tentativas_prova_prova_matricula_numero_uidx
  on public.tentativas_prova (prova_id, matricula_id, numero);

create table public.respostas_prova (
  id uuid primary key default gen_random_uuid(),
  tentativa_id uuid not null references public.tentativas_prova (id) on delete cascade,
  questao_prova_id uuid not null references public.questoes_prova (id) on delete cascade,
  -- set null (não cascade), mesmo raciocínio do quiz: editar/excluir uma
  -- alternativa depois que alunos já responderam não deveria apagar o
  -- histórico de respostas — "correta" abaixo já congela o resultado.
  alternativa_prova_id uuid references public.alternativas_prova (id) on delete set null,
  resposta_texto text,
  correta boolean, -- null = dissertativa (sem correção automática)
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create index respostas_prova_tentativa_id_idx on public.respostas_prova (tentativa_id);
create index respostas_prova_questao_prova_id_idx on public.respostas_prova (questao_prova_id);

alter table public.tentativas_prova enable row level security;
alter table public.respostas_prova enable row level security;

create policy "Admins podem ver tentativas de prova"
  on public.tentativas_prova for select using (public.is_admin());

create policy "Alunos podem ver suas próprias tentativas de prova"
  on public.tentativas_prova for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = tentativas_prova.matricula_id and m.aluno_id = auth.uid()
    )
  );

-- Sem policy nem grant de insert aqui de propósito — nota/aprovado não
-- podem ser confiados a um insert direto do client. A única forma de
-- criar uma tentativa é via criar_tentativa_prova (security definer, mais
-- abaixo), que reimplementa essas checagens explicitamente no corpo, já
-- que ela ignora RLS. Sem update/delete pra ninguém via API — tentativa é
-- histórico imutável.

create policy "Admins podem ver respostas de prova"
  on public.respostas_prova for select using (public.is_admin());

create policy "Alunos podem ver suas próprias respostas de prova"
  on public.respostas_prova for select
  using (
    exists (
      select 1
      from public.tentativas_prova tp
      join public.matriculas m on m.id = tp.matricula_id
      where tp.id = respostas_prova.tentativa_id and m.aluno_id = auth.uid()
    )
  );

-- Mesmo raciocínio: correta não pode ser confiado a um insert direto do
-- client. Sem policy nem grant de insert — só criar_tentativa_prova
-- escreve aqui.
grant select on public.tentativas_prova to authenticated;

grant select on public.respostas_prova to authenticated;

-- Falta select de aluno em questoes_prova/alternativas_prova (só admin
-- tinha até aqui — mesma situação que questoes/alternativas tinham antes
-- do quiz).
create policy "Alunos podem ver questoes de provas de cursos em que estão matriculados"
  on public.questoes_prova for select
  using (
    exists (
      select 1
      from public.provas pv
      join public.modulos mo on mo.id = pv.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where pv.id = questoes_prova.prova_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver alternativas de questoes de provas de cursos em que estão matriculados"
  on public.alternativas_prova for select
  using (
    exists (
      select 1
      from public.questoes_prova qp
      join public.provas pv on pv.id = qp.prova_id
      join public.modulos mo on mo.id = pv.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where qp.id = alternativas_prova.questao_prova_id and m.aluno_id = auth.uid()
    )
  );

-- Correção automática roda aqui dentro, não no Server Action — quem
-- decide o que é "correta" é sempre o banco, nunca o valor que o client
-- mandar. "security definer": não existe grant de insert em
-- tentativas_prova/respostas_prova pra authenticated — essa function é a
-- ÚNICA forma de escrever nessas tabelas, então roda com privilégio
-- elevado e ignora RLS. Por isso, logo no início, reimplementa
-- explicitamente as checagens de posse da matrícula e consistência
-- prova-curso — sem RLS nesse caminho, essa validação é a única linha de
-- defesa. tentativas_maximas também é conferido aqui, antes de processar
-- qualquer resposta, não só na Server Action.
create function public.criar_tentativa_prova(
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

  -- Filtra por prova_id explicitamente (não confia em RLS de insert de
  -- respostas_prova pra barrar questão de outro contexto). Confere que
  -- vieram TODAS as questões da prova, sem duplicata.
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

grant execute on function public.criar_tentativa_prova(uuid, uuid, uuid[], uuid[], text[])
  to authenticated;
