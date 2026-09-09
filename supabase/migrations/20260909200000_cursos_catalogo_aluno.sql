-- Alunos podem ver catálogo de cursos ativos (necessário para
-- a seção "Conheça outros cursos" no portal do aluno)
create policy "Alunos podem ver o catalogo de cursos ativos"
  on public.cursos for select using (status = 'ativo');
