-- Visualizador de PDF do aluno: falta a policy de select em storage.objects
-- (hoje só admin tem). Sem isso, createSignedUrl() falha mesmo com a linha
-- de materiais existindo — Storage é uma fronteira de RLS independente da
-- tabela. Nenhum grant novo necessário (schema storage já tem grant padrão
-- para authenticated, mesmo padrão das policies de admin já existentes).

create policy "Alunos podem ver arquivos de materiais de cursos em que estão matriculados"
  on storage.objects for select
  using (
    bucket_id = 'materiais'
    and exists (
      select 1
      from public.materiais mat
      join public.aulas a on a.id = mat.aula_id
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where mat.url = storage.objects.name and m.aluno_id = auth.uid()
    )
  );
