-- "Meus Cursos" do aluno: RLS permissiva (qualquer vínculo dá visibilidade
-- da turma/curso) — filtrar por status de matrícula é regra de apresentação
-- da query da tela, não fronteira de segurança. Grants de select já existem
-- nessas 3 tabelas (usados até hoje só pelo admin); só falta a policy.

create policy "Alunos podem ver as próprias matrículas"
  on public.matriculas for select
  using (aluno_id = auth.uid());

create policy "Alunos podem ver turmas em que estão matriculados"
  on public.turmas for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.turma_id = turmas.id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem ver cursos em que estão matriculados"
  on public.cursos for select
  using (
    exists (
      select 1
      from public.matriculas m
      join public.turmas t on t.id = m.turma_id
      where t.curso_id = cursos.id and m.aluno_id = auth.uid()
    )
  );
