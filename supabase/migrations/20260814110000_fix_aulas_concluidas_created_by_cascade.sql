-- aulas_concluidas.created_by (a própria conta do aluno) não tinha "on
-- delete cascade" — copiei o padrão de created_by usado em presencas/
-- materiais/etc. sem perceber a diferença: lá created_by é sempre o admin
-- (que na prática nunca é excluído). Aqui created_by é o próprio aluno, que
-- pode ser excluído a qualquer momento via /admin/alunos (deleteAluno chama
-- admin.auth.admin.deleteUser diretamente). Sem cascade, excluir um aluno
-- que já marcou qualquer aula como concluída falha (confirmado em teste).

alter table public.aulas_concluidas
  drop constraint aulas_concluidas_created_by_fkey;

alter table public.aulas_concluidas
  add constraint aulas_concluidas_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete cascade;
