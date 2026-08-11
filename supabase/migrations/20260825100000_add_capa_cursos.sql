-- Capa de curso estilo pôster (proporção 2:3), opcional. Guarda só o
-- caminho dentro do bucket "cursos" — mesma convenção de premios.foto_url
-- — a URL pública é montada em runtime com getPublicUrl().

alter table public.cursos
  add column capa_url text;

grant insert (capa_url) on public.cursos to authenticated;
grant update (capa_url) on public.cursos to authenticated;

-- Storage: bucket público (conteúdo promocional, não protegido — mesmo
-- padrão de "premios", diferente de "materiais" que é privado). Upload/
-- gestão do arquivo continua só admin.
insert into storage.buckets (id, name, public) values ('cursos', 'cursos', true);

create policy "Admins podem enviar capas de cursos"
  on storage.objects for insert
  with check (bucket_id = 'cursos' and public.is_admin());
create policy "Admins podem atualizar capas de cursos"
  on storage.objects for update
  using (bucket_id = 'cursos' and public.is_admin());
create policy "Admins podem excluir capas de cursos"
  on storage.objects for delete
  using (bucket_id = 'cursos' and public.is_admin());
