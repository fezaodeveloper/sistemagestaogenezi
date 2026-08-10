-- Fecha a lacuna encontrada ao revisar o hardening de toggleAulaConcluida:
-- aulas_concluidas tem grant de insert direto pro aluno (diferente de
-- quiz/prova), e a policy de insert original só validava dono da matrícula
-- + consistência aula/curso — nunca liberação. Um insert direto via client
-- Supabase (bypassando a Server Action) ainda seria aceito. A checagem na
-- Server Action continua útil (mensagem de erro amigável), mas não é
-- fronteira de segurança real sem isso.
create function public.aula_liberada_para_matricula(p_matricula_id uuid, p_aula_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  with turma_da_matricula as (
    select turma_id from public.matriculas where id = p_matricula_id
  ),
  calendario as (
    select * from public.calendario_aulas_turma((select turma_id from turma_da_matricula))
  ),
  aula_atual as (
    select * from calendario where aula_id = p_aula_id
  )
  select case
    -- Sem cadência configurada (curso EAD, ou turma presencial/híbrida
    -- ainda sem cronograma): sem restrição.
    when not exists (select 1 from calendario) then true
    -- Aula não encontrada no calendário da turma dessa matrícula (não
    -- pertence ao curso, ou id inválido): nunca libera.
    when not exists (select 1 from aula_atual) then false
    when not (select liberada_calendario from aula_atual) then false
    when (select numero_sessao from aula_atual) = 1 then true
    else exists (
      select 1 from public.aulas_concluidas ac
      join calendario c on c.aula_id = ac.aula_id
      where ac.matricula_id = p_matricula_id
      and c.numero_sessao = (select numero_sessao from aula_atual) - 1
    )
  end;
$$;

grant execute on function public.aula_liberada_para_matricula(uuid, uuid) to authenticated;

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
  );
