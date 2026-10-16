-- NÃO APLICADA — aplicar manualmente pelo Supabase SQL Editor

-- "resgates" só tinha grant pra "authenticated" (20260823100000_create_creditos_premios_resgates.sql)
-- — nenhuma rotina precisava do client admin (service_role) pra lê-la até agora. O comando
-- /resgates do bot do Telegram (Fase 3.4) roda via createAdminClient() (webhook não tem sessão de
-- usuário autenticado), e service_role bypassa RLS mas não bypassa grants de tabela (ver CLAUDE.md)
-- — sem este grant, a query falha com "permission denied for table resgates".
grant select on public.resgates to service_role;
