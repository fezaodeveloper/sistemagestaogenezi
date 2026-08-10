-- Fase 8: Gamificação — pontos e ranking (parte 1: base; badges e streak
-- ficam pra depois). Ledger de eventos de pontuação: cada linha é um
-- evento de N pontos, soma = total. Não é insert-only puro — referencia_id
-- (id da linha de origem: presencas.id, aulas.id, quizzes.id, provas.id;
-- nunca uma FK de verdade, já que a tabela varia por tipo_evento), junto
-- com matricula_id+tipo_evento, forma uma chave lógica estável que permite
-- substituir um evento (nota melhorada numa nova tentativa, presença
-- corrigida) via ON CONFLICT DO UPDATE, sem duplicar pontos.
create type public.pontos_tipo_evento as enum ('presenca', 'aula_concluida', 'quiz', 'prova');

create table public.pontos_eventos (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  tipo_evento public.pontos_tipo_evento not null,
  pontos integer not null check (pontos >= 0),
  referencia_id uuid not null,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pontos_eventos_matricula_id_idx on public.pontos_eventos (matricula_id);

create unique index pontos_eventos_origem_uidx
  on public.pontos_eventos (matricula_id, tipo_evento, referencia_id);

alter table public.pontos_eventos enable row level security;

create policy "Admins podem ver eventos de pontos"
  on public.pontos_eventos for select using (public.is_admin());

create policy "Alunos podem ver seus próprios eventos de pontos"
  on public.pontos_eventos for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = pontos_eventos.matricula_id and m.aluno_id = auth.uid()
    )
  );

create trigger on_pontos_eventos_updated
  before update on public.pontos_eventos
  for each row execute function public.handle_updated_at();

-- Sem grant de insert/update/delete pra authenticated — mesmo princípio já
-- usado em tentativas_quiz/tentativas_prova: só functions security
-- definer escrevem aqui (upsert_presencas, marcar_aula_concluida,
-- criar_tentativa_quiz, criar_tentativa_prova). Mesmo uma regra
-- aparentemente simples como "aula concluída = 5 pontos fixos" não pode
-- ter grant direto — abriria a porta pro aluno inserir qualquer
-- tipo_evento com qualquer valor de pontos.
grant select on public.pontos_eventos to authenticated;

-- Configurações gerais do sistema (singleton — uma linha só, garantida
-- pela PK boolean + check). Começa só com o toggle de gamificação EAD, mas
-- nasce genérica pra acumular outras configurações futuras na mesma linha.
create table public.configuracoes (
  id boolean primary key default true,
  constraint configuracoes_singleton check (id),
  ead_participa_gamificacao boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.configuracoes (id) values (true);

alter table public.configuracoes enable row level security;

-- Não é dado sensível, e o aluno precisa ler o valor atual na própria
-- sessão (pra saber se conta pontos de curso EAD / aparece no ranking).
create policy "Todos autenticados podem ver configuracoes"
  on public.configuracoes for select using (true);

create policy "Admins podem atualizar configuracoes"
  on public.configuracoes for update using (public.is_admin()) with check (public.is_admin());

grant select on public.configuracoes to authenticated;
grant update (ead_participa_gamificacao, updated_by) on public.configuracoes to authenticated;

-- Ranking geral: agrega pontos_eventos por aluno, somando entre TODAS as
-- matrículas dele (mesmo raciocínio de agregação por aluno já usado em
-- "Meus Cursos"), sem segmentar por turma/curso. Filtra curso EAD pelo
-- toggle atual no momento da CONSULTA, não no momento do evento — todo
-- evento de curso EAD é sempre gravado (histórico completo preservado em
-- pontos_eventos); ligar/desligar o toggle depois é totalmente reversível,
-- sem reprocessar nada.
--
-- View comum, não security_invoker — de propósito: expõe só
-- aluno_id/full_name/total_pontos, uma projeção pública deliberadamente
-- estreita, sem precisar abrir a RLS de profiles (hoje aluno só vê o
-- próprio perfil) pra alunos verem nome uns dos outros.
create view public.ranking_geral as
select
  p.id as aluno_id,
  p.full_name,
  sum(pe.pontos) as total_pontos
from public.pontos_eventos pe
join public.matriculas m on m.id = pe.matricula_id
join public.turmas t on t.id = m.turma_id
join public.cursos c on c.id = t.curso_id
join public.profiles p on p.id = m.aluno_id
where c.tipo <> 'ead' or (select ead_participa_gamificacao from public.configuracoes)
group by p.id, p.full_name;

grant select on public.ranking_geral to authenticated;

-- upsert_presencas passa a também lançar pontos, e por isso precisa virar
-- security definer (era security invoker, confiando na RLS de presencas)
-- — reimplementa is_admin() explicitamente, já que RLS de pontos_eventos
-- não dá grant nenhum pra authenticated, nem admin. Presença/falta
-- justificada só valem pontos em curso presencial/híbrido — curso EAD
-- sempre 0 aqui, independente do toggle (não é sobre participar da
-- gamificação, é sobre presença não ser um conceito que se aplica a EAD).
-- Status 'reposicao' tratado como falta (0 pontos na sessão original).
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
end;
$$;

-- marcar_aula_concluida: NOVA function — até aqui, marcar aula concluída
-- era um insert direto (RLS de aulas_concluidas já validava matrícula,
-- liberação, expiração). Precisou virar function pra lançar pontos com
-- segurança — reimplementa exatamente essas mesmas checagens, já que
-- security definer bypassa RLS. 5 pontos fixos, qualquer tipo de curso
-- (inclusive EAD — o toggle só filtra na hora de exibir o ranking, não
-- impede o registro do evento). on conflict do nothing tanto no insert de
-- aulas_concluidas quanto no de pontos_eventos: idempotente, sem duplicar
-- nada se chamado de novo pra uma aula já concluída. Pontos são
-- permanentes uma vez conquistados — desmarcar a aula (delete em
-- aulas_concluidas) não reverte a linha em pontos_eventos.
create function public.marcar_aula_concluida(p_matricula_id uuid, p_aula_id uuid)
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
end;
$$;

grant execute on function public.marcar_aula_concluida(uuid, uuid) to authenticated;

-- aulas_concluidas deixa de aceitar insert direto — marcar_aula_concluida
-- passa a ser o único caminho de escrita (mesmo padrão de
-- tentativas_quiz/tentativas_prova). Sem isso, um insert direto
-- continuaria funcionando (a policy de select/delete não muda) só que sem
-- gerar pontos — inconsistente, sem necessidade de manter os dois
-- caminhos vivos.
drop policy "Alunos podem marcar suas próprias aulas concluídas" on public.aulas_concluidas;
revoke insert (matricula_id, aula_id) on public.aulas_concluidas from authenticated;

-- criar_tentativa_quiz: mesma assinatura e corpo já existente (checagem de
-- matrícula, expiração, consistência quiz-curso, limite de tentativas,
-- correção via temp table), só acrescenta o lançamento de pontos no final
-- — proporcional à nota (0-20), melhor nota entre tentativas prevalece
-- (GREATEST no ON CONFLICT), evita pontos inflados por tentativa repetida
-- sem limite configurado.
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

  return v_tentativa_id;
end;
$$;

-- criar_tentativa_prova: espelha o quiz, peso maior (0-40).
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

  return v_tentativa_id;
end;
$$;
