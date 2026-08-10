-- Calendário de liberação de conteúdo (fase de cronograma, parte 3). Dada
-- uma turma, devolve a data de liberação de cada aula do curso, numerada de
-- forma contínua (módulo.numero, aula.numero — não reinicia por módulo).
--
-- security invoker (não definer): é leitura pura, não grava nada. A RLS de
-- turmas/modulos/aulas já resolve sozinha quem pode ver o quê — se chamada
-- com um turma_id que o aluno não pertence, o resultado vem vazio, sem
-- vazamento.
--
-- Quando turmas.cadencia_dias_semana é null (curso EAD, ou turma
-- presencial/híbrida ainda sem cadência configurada), a function devolve
-- zero linhas — sinal que o TypeScript interpreta como "sem restrição de
-- calendário, tudo liberado por essa perna". Cobre os dois casos com o
-- mesmo código, sem checagem especial de cursos.tipo.
create function public.calendario_aulas_turma(p_turma_id uuid)
returns table (
  aula_id uuid,
  numero_sessao integer,
  data_liberacao date,
  liberada_calendario boolean
)
language sql
security invoker
set search_path = ''
stable
as $$
  with turma as (
    select data_inicio, cadencia_dias_semana
    from public.turmas
    where id = p_turma_id
  ),
  aulas_ordenadas as (
    select a.id as aula_id,
      row_number() over (order by mo.numero, a.numero) as numero_sessao
    from public.aulas a
    join public.modulos mo on mo.id = a.modulo_id
    join public.turmas t on t.curso_id = mo.curso_id
    where t.id = p_turma_id
  ),
  dias_cadencia as (
    select case dia
      when 'domingo' then 7 when 'segunda' then 1 when 'terca' then 2
      when 'quarta' then 3 when 'quinta' then 4 when 'sexta' then 5
      when 'sabado' then 6
    end as isodow
    from turma, unnest(cadencia_dias_semana) as dia
  ),
  -- Gera dias suficientes pra cobrir todas as sessões necessárias: número
  -- de aulas / dias por semana da cadência, com 3 semanas de folga pra
  -- garantir cobertura mesmo com desalinhamento no início.
  calendario as (
    select d::date as data, row_number() over (order by d) as numero_sessao
    from turma,
      generate_series(
        data_inicio,
        data_inicio + (
          (select count(*) from aulas_ordenadas)
          / greatest((select count(*) from dias_cadencia), 1) + 3
        ) * interval '7 days',
        interval '1 day'
      ) as d
    where extract(isodow from d)::int in (select isodow from dias_cadencia)
  )
  select ao.aula_id, ao.numero_sessao, c.data,
    c.data <= current_date
  from aulas_ordenadas ao
  join calendario c using (numero_sessao)
  order by ao.numero_sessao;
$$;

grant execute on function public.calendario_aulas_turma(uuid) to authenticated;
