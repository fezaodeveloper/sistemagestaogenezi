-- Necessária pra Melhoria 1 (vagas disponíveis nos cursos bloqueados,
-- src/app/aluno/page.tsx) funcionar de verdade — sem isso, a query de
-- vagas roda com o client autenticado normal (respeita RLS) e a única
-- policy de select em turmas pra aluno cobre só turmas em que ele JÁ está
-- matriculado (20260811100000_add_aluno_rls_meus_cursos.sql); turmas de um
-- curso que ele ainda não cursa ficam invisíveis, então "vagas disponíveis"
-- sempre viria null/0, mesmo quando a turma tem vagas de verdade.
--
-- Mesmo padrão já usado em "Alunos podem ver o catalogo de cursos ativos"
-- (20260909200000_cursos_catalogo_aluno.sql): libera só o que já é público
-- no catálogo (status = 'ativa'), não dados de matrícula de outros alunos.
-- Mostrar SQL — NÃO aplicar.

create policy "Alunos podem ver turmas ativas de cursos ativos"
  on public.turmas for select using (status = 'ativa');
