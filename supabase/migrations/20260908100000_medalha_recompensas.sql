-- Recompensas vinculadas a medalhas (TAREFA 4) + pontuações configuráveis
-- (TAREFA 5).

-- ===== PARTE 1: medalha_recompensas =====

create table public.medalha_recompensas (
  id uuid primary key default gen_random_uuid(),
  badge_id text not null references public.badges(id) on delete cascade,
  tipo text not null check (tipo in ('premio','curso')),
  premio_id uuid references public.premios(id) on delete cascade,
  curso_id uuid references public.cursos(id) on delete cascade,
  descricao_recompensa text,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint check_recompensa check (
    (tipo = 'premio' and premio_id is not null and curso_id is null) or
    (tipo = 'curso' and curso_id is not null and premio_id is null)
  )
);

alter table public.medalha_recompensas enable row level security;
create policy "Admins gerenciam recompensas"
  on public.medalha_recompensas for all using (public.is_admin());
create policy "Alunos veem recompensas"
  on public.medalha_recompensas for select using (true);

grant select on public.medalha_recompensas to authenticated;
grant insert, update, delete on public.medalha_recompensas to authenticated;
-- Além do pedido original: verificarBadgesProgressivos (TAREFA 4C) lê essa
-- tabela pelo client admin (service_role) pra saber se o badge concedido
-- tem recompensa vinculada — sem grant nenhum pra service_role, essa
-- leitura falharia (mesmo caso já documentado no CLAUDE.md sobre grants
-- não seguirem os defaults do Postgres).
grant select, insert, update, delete on public.medalha_recompensas to service_role;

-- ===== PARTE 2: log de recompensas resgatadas =====
-- Decisão tomada em revisão: matriculas não tem coluna "tipo" pra marcar
-- "veio de recompensa de medalha" (só status) — em vez de alterar essa
-- tabela core, o vínculo badge->recompensa->aluno fica só aqui, numa
-- tabela de log dedicada. unique(aluno_id, recompensa_id) garante que a
-- mesma recompensa nunca é concedida duas vezes pro mesmo aluno (mesmo
-- papel do onConflict/ignoreDuplicates de badges_conquistados).

create table public.medalha_recompensas_resgatadas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  recompensa_id uuid not null references public.medalha_recompensas(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  tipo text not null check (tipo in ('premio','curso')),
  matricula_criada_id uuid references public.matriculas(id) on delete set null,
  pontos_creditados integer,
  created_at timestamptz not null default now(),
  unique (aluno_id, recompensa_id)
);

create index medalha_recompensas_resgatadas_aluno_id_idx
  on public.medalha_recompensas_resgatadas (aluno_id);

alter table public.medalha_recompensas_resgatadas enable row level security;
create policy "Admins veem recompensas resgatadas"
  on public.medalha_recompensas_resgatadas for select using (public.is_admin());
create policy "Aluno ve suas recompensas resgatadas"
  on public.medalha_recompensas_resgatadas for select using (aluno_id = auth.uid());

grant select on public.medalha_recompensas_resgatadas to authenticated;
grant select, insert, update, delete on public.medalha_recompensas_resgatadas to service_role;

-- ===== PARTE 3: grants pendentes pra service_role =====
-- Concessão de recompensa (TAREFA 4C) roda inteira via client admin
-- (verificarBadgesProgressivos já opera assim): precisa ler turmas/cursos
-- e inserir em matriculas (recompensa tipo 'curso') e em pontos_eventos
-- (recompensa tipo 'premio', via bônus de pontos). Nenhuma das 4 tinha
-- grant pra service_role — turmas/cursos/matriculas já eram uma pendência
-- conhecida documentada no CLAUDE.md ("corrigir se e quando alguma rotina
-- passar a precisar do bypass nessas tabelas"); chegou a vez.
grant select, insert, update, delete on public.turmas to service_role;
grant select, insert, update, delete on public.cursos to service_role;
grant select, insert, update, delete on public.matriculas to service_role;
grant select, insert, update, delete on public.pontos_eventos to service_role;

-- Novos tipos de evento de pontos: módulo/curso concluído (TAREFA 5C, novo
-- — não existia nenhum evento pra isso até aqui) e bônus de recompensa de
-- medalha (TAREFA 4C, prêmio tipo 'premio').
alter type public.pontos_tipo_evento add value if not exists 'modulo_concluido';
alter type public.pontos_tipo_evento add value if not exists 'curso_concluido';
alter type public.pontos_tipo_evento add value if not exists 'recompensa_medalha';

-- ===== PARTE 4: pontuações configuráveis (TAREFA 5A) =====

alter table public.configuracoes
  add column if not exists pts_aula_concluida integer default 10,
  add column if not exists pts_quiz_concluido integer default 5,
  add column if not exists pts_nota_maxima integer default 20,
  add column if not exists pts_presenca integer default 15,
  add column if not exists pts_modulo_concluido integer default 50,
  add column if not exists pts_curso_concluido integer default 200,
  add column if not exists limite_pts_dia integer default 100;

grant update (
  pts_aula_concluida, pts_quiz_concluido, pts_nota_maxima,
  pts_presenca, pts_modulo_concluido, pts_curso_concluido, limite_pts_dia
) on public.configuracoes to authenticated;

-- ===== PARTE 5: functions de pontuação passam a ler configuracoes =====
-- limite_pts_dia é só armazenado nesta migration — a aplicação real do
-- teto diário fica pra uma tarefa futura (decisão tomada em revisão, pra
-- não alterar o comportamento de 4 functions de segurança já em produção
-- sem mais contexto sobre como truncar o excedente).
--
-- Nota: "pts_quiz_concluido" e "pts_nota_maxima" NÃO viram uma pontuação
-- flat + bônus por nota 100% (isso mudaria o modelo de pontuação já em
-- produção). Em vez disso, cada um passa a ser o novo valor MÁXIMO (nota
-- 100%) das fórmulas proporcionais já existentes — pts_quiz_concluido pro
-- quiz (substituindo o 20 fixo), pts_nota_maxima pra prova (substituindo o
-- 40 fixo). Decisão tomada em revisão, menor risco pra pontuação histórica.

-- upsert_presencas: só troca os pontos fixos (10/5) por pts_presenca
-- configurável (justificada mantém a proporção 1:2 já existente).
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
  v_pts_presenca integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar presenças.';
  end if;

  select c.tipo into v_curso_tipo
  from public.aulas a
  join public.modulos mo on mo.id = a.modulo_id
  join public.cursos c on c.id = mo.curso_id
  where a.id = p_aula_id;

  select pts_presenca into v_pts_presenca from public.configuracoes;
  v_pts_presenca := coalesce(v_pts_presenca, 10);

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
      when pu.status = 'presente' then v_pts_presenca
      when pu.status = 'justificada' then round(v_pts_presenca / 2.0)
      else 0
    end,
    pu.id
  from presencas_upsert pu
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = excluded.pontos;
end;
$$;

-- marcar_aula_concluida: pontos fixos (5) viram pts_aula_concluida
-- configurável, e passa a também lançar pts_modulo_concluido/
-- pts_curso_concluido quando a aula concluída fecha o módulo/curso inteiro
-- (mesma checagem de "todas as aulas concluídas" já usada em
-- verificar_conquistas_aluno, migration 20260822100000, só que escopada à
-- matrícula — pontos são por matrícula, diferente de badge que é por
-- aluno).
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

  select pts_aula_concluida, pts_modulo_concluido, pts_curso_concluido
  into v_pts_aula_concluida, v_pts_modulo_concluido, v_pts_curso_concluido
  from public.configuracoes;

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'aula_concluida', coalesce(v_pts_aula_concluida, 5), p_aula_id)
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
    insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
    values (p_matricula_id, 'modulo_concluido', coalesce(v_pts_modulo_concluido, 50), v_modulo_id)
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
      insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
      values (p_matricula_id, 'curso_concluido', coalesce(v_pts_curso_concluido, 200), v_curso_id)
      on conflict (matricula_id, tipo_evento, referencia_id) do nothing;
    end if;
  end if;
end;
$$;

-- criar_tentativa_quiz: só troca o teto fixo (20) por pts_quiz_concluido —
-- resto do corpo idêntico ao já existente.
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

  select pts_quiz_concluido into v_pts_quiz_concluido from public.configuracoes;

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'quiz', round(v_nota * coalesce(v_pts_quiz_concluido, 20) / 100.0), p_quiz_id)
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = greatest(pontos_eventos.pontos, excluded.pontos);

  return v_tentativa_id;
end;
$$;

-- criar_tentativa_prova: espelha o quiz, só troca o teto fixo (40) por
-- pts_nota_maxima.
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

  select pts_nota_maxima into v_pts_nota_maxima from public.configuracoes;

  insert into public.pontos_eventos (matricula_id, tipo_evento, pontos, referencia_id)
  values (p_matricula_id, 'prova', round(v_nota * coalesce(v_pts_nota_maxima, 40) / 100.0), p_prova_id)
  on conflict (matricula_id, tipo_evento, referencia_id)
  do update set pontos = greatest(pontos_eventos.pontos, excluded.pontos);

  return v_tentativa_id;
end;
$$;
