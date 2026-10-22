-- NÃO APLICADA — aplicar manualmente no SQL Editor

-- Curso gratuito como BÔNUS da matrícula, não substituto do curso principal (pago) — campo
-- separado, independente de turma_id/valores. Ver correção em matricula-wizard.tsx: antes,
-- escolher um curso gratuito chamava handleSelecionarCurso() e substituía o curso principal
-- inteiro (turma, módulos, valor) — bug real, corrigido junto com esta migration.

alter table public.matriculas
  add column if not exists curso_bonus_id uuid references public.cursos (id);

comment on column public.matriculas.curso_bonus_id is
  'Curso gratuito bônus vinculado à matrícula (opcional) — adicional ao curso principal (via turma_id), nunca o substitui';

-- select já é concedido na tabela inteira pra authenticated/service_role (sem restrição de
-- coluna, ver create_matriculas) — só insert/update por coluna específica precisam de grant novo.
grant insert (curso_bonus_id) on public.matriculas to authenticated;
grant update (curso_bonus_id) on public.matriculas to authenticated;
