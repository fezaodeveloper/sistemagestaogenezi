-- Liberação manual de aula por aluno específico (fase de cronograma, parte
-- 4) — exceção ao calendário/sequência normal. Vinculada a matrícula (não
-- aluno_id direto), mesmo raciocínio de aulas_concluidas: o mesmo aluno
-- pode ter matrículas diferentes ao longo do tempo, e a liberação é
-- por-matrícula. "Liberar o módulo inteiro" não é um conceito no schema —
-- é a Server Action de admin que insere uma linha por aula do módulo.
create table public.liberacoes_manuais (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aula_id uuid not null references public.aulas (id) on delete cascade,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index liberacoes_manuais_matricula_id_idx on public.liberacoes_manuais (matricula_id);
create index liberacoes_manuais_aula_id_idx on public.liberacoes_manuais (aula_id);

-- Liberar a mesma aula duas vezes pra mesma matrícula deve ser idempotente
-- (a Server Action de "liberar módulo inteiro" usa upsert com
-- ignoreDuplicates), não duplicar linha.
create unique index liberacoes_manuais_matricula_aula_uidx
  on public.liberacoes_manuais (matricula_id, aula_id);

alter table public.liberacoes_manuais enable row level security;

create policy "Admins podem ver liberacoes manuais"
  on public.liberacoes_manuais for select using (public.is_admin());

-- Aluno não tem tela pra isso, mas PRECISA conseguir ler a própria
-- liberação — é isso que aula_liberada_para_matricula (chamada com o papel
-- do aluno, security invoker) e getLiberacaoAulasCurso (mesma sessão)
-- consultam pra aplicar o efeito.
create policy "Alunos podem ver suas próprias liberações manuais"
  on public.liberacoes_manuais for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = liberacoes_manuais.matricula_id and m.aluno_id = auth.uid()
    )
  );

create policy "Admins podem criar liberacoes manuais"
  on public.liberacoes_manuais for insert
  with check (
    public.is_admin()
    and exists (
      select 1
      from public.aulas a
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where a.id = liberacoes_manuais.aula_id and m.id = liberacoes_manuais.matricula_id
    )
  );

-- Sem policy/grant de update ou delete: liberação é permanente nesta fase
-- (sem "revogar" — se precisarmos depois, adicionamos).
grant select on public.liberacoes_manuais to authenticated;
grant insert (matricula_id, aula_id) on public.liberacoes_manuais to authenticated;

-- Incorpora liberação manual em aula_liberada_para_matricula — mesma
-- function usada pela RLS de aulas_concluidas (Parte 3). Checa liberação
-- manual PRIMEIRO (curto-circuito antes de qualquer cálculo de
-- calendário); o resto da function é idêntico ao que já existia.
create or replace function public.aula_liberada_para_matricula(p_matricula_id uuid, p_aula_id uuid)
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
  select
    exists (
      select 1 from public.liberacoes_manuais
      where matricula_id = p_matricula_id and aula_id = p_aula_id
    )
    or case
      when not exists (select 1 from calendario) then true
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
