-- service_role bypassa RLS, mas não bypassa os grants de tabela — sem isso,
-- o client admin (chave secreta) recebe "permission denied" mesmo com RLS
-- desabilitada para esse role. Diferente de `authenticated`, aqui o grant é
-- amplo e sem restrição de coluna, já que service_role é a role de bypass.
grant select, insert, update, delete on public.profiles to service_role;
