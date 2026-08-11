-- Capa de módulo estilo miniatura (proporção 16:9), opcional. Mesma
-- convenção de cursos.capa_url — guarda só o caminho dentro do bucket
-- "modulos", URL pública montada em runtime com getPublicUrl().

alter table public.modulos
  add column capa_url text;

grant insert (capa_url) on public.modulos to authenticated;
grant update (capa_url) on public.modulos to authenticated;

-- Storage: bucket público (mesma lógica de "cursos" e "premios" — não é
-- conteúdo protegido, serve via URL pública direta). Upload/gestão do
-- arquivo continua só admin.
insert into storage.buckets (id, name, public) values ('modulos', 'modulos', true);

create policy "Admins podem enviar capas de modulos"
  on storage.objects for insert
  with check (bucket_id = 'modulos' and public.is_admin());
create policy "Admins podem atualizar capas de modulos"
  on storage.objects for update
  using (bucket_id = 'modulos' and public.is_admin());
create policy "Admins podem excluir capas de modulos"
  on storage.objects for delete
  using (bucket_id = 'modulos' and public.is_admin());
