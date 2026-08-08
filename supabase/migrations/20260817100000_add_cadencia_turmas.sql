-- Cadência semanal de liberação de conteúdo (fase de cronograma). Só se
-- aplica a turmas de cursos presenciais/híbridos — cursos EAD continuam com
-- liberação livre, sem cronograma. A coluna fica nullable pra qualquer
-- turma; a UI decide mostrar/esconder o bloco a partir de cursos.tipo, e a
-- Server Action garante null pra turmas de curso EAD independente do que
-- vier no submit.
create type public.dia_semana as enum (
  'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
);

alter table public.turmas
  add column cadencia_dias_semana public.dia_semana[];

-- "Quantas vezes por semana" não é uma coluna própria — é sempre
-- cardinality(cadencia_dias_semana), pra nunca sair de sincronia com os
-- dias de fato marcados.
alter table public.turmas
  add constraint turmas_cadencia_dias_check check (
    cadencia_dias_semana is null
    or cardinality(cadencia_dias_semana) between 1 and 7
  );

grant insert (cadencia_dias_semana) on public.turmas to authenticated;
grant update (cadencia_dias_semana) on public.turmas to authenticated;
