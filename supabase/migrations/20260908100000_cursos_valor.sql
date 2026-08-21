alter table public.cursos
  add column valor numeric(10, 2) default null;

-- Grant de insert adicionado além do pedido original (só update): a Server
-- Action createCurso também grava valor no INSERT, e sem esse grant a
-- coluna seria rejeitada nesse momento — mesmo padrão já usado em
-- capa_url/carga_horaria_horas (insert + update juntos).
grant insert (valor) on public.cursos to authenticated;
grant update (valor) on public.cursos to authenticated;
