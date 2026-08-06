-- Navegação de módulos/aulas do aluno: RLS permissiva (qualquer vínculo dá
-- visibilidade), mesmo padrão da migration anterior — filtrar por status de
-- matrícula continua sendo regra da query da tela, não fronteira de segurança.
-- Grants de select já existem em todas essas tabelas (usados até hoje só
-- pelo admin); só falta a policy. Materiais/quizzes/provas: só existência
-- (contagem/tipo) é exposta nesta fase, o conteúdo (questões, PDF/vídeo) fica
-- para quando o player/visualizador e a tela de responder forem construídos.

create policy "Alunos podem ver módulos de cursos em que estão matriculados"
  on public.modulos for select
  using (
    exists (
      select 1
      from public.matriculas m
      join public.turmas t on t.id = m.turma_id
      where t.curso_id = modulos.curso_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver aulas de cursos em que estão matriculados"
  on public.aulas for select
  using (
    exists (
      select 1
      from public.modulos mo
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where mo.id = aulas.modulo_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver materiais de cursos em que estão matriculados"
  on public.materiais for select
  using (
    exists (
      select 1
      from public.aulas a
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where a.id = materiais.aula_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver quizzes de cursos em que estão matriculados"
  on public.quizzes for select
  using (
    exists (
      select 1
      from public.aulas a
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where a.id = quizzes.aula_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver provas de cursos em que estão matriculados"
  on public.provas for select
  using (
    exists (
      select 1
      from public.modulos mo
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where mo.id = provas.modulo_id and m.aluno_id = auth.uid()
    )
  );
