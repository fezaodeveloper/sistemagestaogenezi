-- Policy de select faltante em storage.objects pro bucket escola-logo —
-- necessária pro upsert:true no upload da logo funcionar (o Supabase
-- Storage precisa checar se o objeto já existe antes de decidir entre
-- insert e update internamente). Sem ela, upsert:true pode falhar com
-- "The resource already exists" mesmo removendo o arquivo antes.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create policy "Admins veem logo da escola"
  on storage.objects for select
  using (bucket_id = 'escola-logo' and public.is_admin());
