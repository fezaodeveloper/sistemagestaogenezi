-- NÃO APLICADA — aplicar manualmente pelo Supabase SQL Editor
--
-- RPC: retorna aluno_id de matrículas ativas cujo aluno não concluiu nenhuma aula nos últimos N
-- dias — usada pelo botão "Inativos (7 dias)" em /admin/alunos.
--
-- set search_path = '' + nomes com prefixo public.: mesmo endurecimento já usado por toda
-- function SECURITY DEFINER deste projeto (ver calendario_aulas_turma em
-- 20260818100000_create_calendario_aulas_turma.sql, embora essa use security invoker) — sem
-- isso, um search_path manipulado na sessão que chama a function poderia sombrear
-- matriculas/alunos/profiles/aulas_concluidas com objetos de outro schema, rodando com os
-- privilégios elevados do dono da function (security definer).
--
-- Observação (não é bug, é comportamento esperado da query como pedida): um aluno com matrícula
-- ativa recém-criada, que ainda não teve TEMPO de concluir nenhuma aula, também entra nesta
-- lista (NOT EXISTS é verdadeiro por vacuidade) — a mensagem trataria "nunca começou" igual a
-- "parou de acessar".
create or replace function public.alunos_sem_aula_ha_dias(dias integer)
returns table (aluno_id uuid, telefone text, nome text)
language sql
security definer
set search_path = ''
stable
as $$
  select distinct on (m.aluno_id)
    m.aluno_id,
    a.telefone,
    p.full_name as nome
  from public.matriculas m
  join public.alunos a on a.id = m.aluno_id
  join public.profiles p on p.id = m.aluno_id
  where m.status = 'ativa'
    and a.telefone is not null
    and a.telefone <> ''
    and not exists (
      select 1
      from public.aulas_concluidas ac
      where ac.matricula_id = m.id
        and ac.concluida_em >= now() - (dias || ' days')::interval
    );
$$;
