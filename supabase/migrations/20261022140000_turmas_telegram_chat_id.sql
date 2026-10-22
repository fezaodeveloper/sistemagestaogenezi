-- NÃO APLICADA

-- Permite notificar o PROFESSOR da turma (não só o chat administrativo
-- fixo) no aviso de presença (cron aviso-presenca, 1h após o início da
-- aula). Não existe cadastro de "professor" como entidade/conta no projeto
-- — turmas.professor já é texto livre, sem login (ver src/lib/turmas/
-- schema.ts) — por isso o campo novo fica na própria turma, assim como
-- "professor" já está.
--
-- Nulo/vazio = pula o aviso individual silenciosamente; o aviso pro chat
-- administrativo (sendTelegram, sem chat_id explícito) continua
-- acontecendo sempre, sem depender deste campo.
alter table public.turmas
  add column if not exists telegram_chat_id text;

grant insert (telegram_chat_id) on public.turmas to authenticated;
grant update (telegram_chat_id) on public.turmas to authenticated;
