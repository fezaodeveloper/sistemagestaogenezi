-- Timestamp ajustado: a TAREFA pedia 20261028100000, mas esse timestamp já foi usado por
-- 20261028100000_conecta_protecao_idade.sql (criada numa mensagem anterior) — não podem
-- ocupar o mesmo timestamp (mesmo ajuste já feito antes em
-- 20260917400000_configuracoes_conecta_habilitado.sql, ver comentário lá).
--
-- conecta_habilitado: ADD COLUMN IF NOT EXISTS é inofensivo aqui, mas a coluna JÁ EXISTE em
-- produção (confirmado por query direta) — a migration 20260917400000, apesar de também estar
-- marcada "NÃO APLICADA" no arquivo, já foi aplicada manualmente em algum momento. As 3 colunas
-- de Telegram do Conecta abaixo são as que de fato ainda não existem.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  add column if not exists conecta_habilitado boolean default true;

-- Chat/grupo do Telegram dedicado a notificações do Gênezi Conecta — separado do Telegram
-- geral da escola (TELEGRAM_CHAT_ID, variável de ambiente usada por enviarMensagemTelegram/
-- enviarAlertaTelegram quando nenhum chat_id explícito é passado). Sem essa coluna preenchida,
-- as notificações de candidato/empresa do Conecta simplesmente não são enviadas (nunca cai no
-- chat geral por engano).
alter table public.configuracoes
  add column if not exists telegram_conecta_chat_id text;

alter table public.configuracoes
  add column if not exists tg_conecta_novo_candidato boolean default true;

alter table public.configuracoes
  add column if not exists tg_conecta_nova_empresa boolean default true;

-- SELECT já é liberado pra authenticated na tabela toda (sem lista de colunas) desde
-- 20260821100000_create_pontos_gamificacao.sql — só falta o GRANT de UPDATE pras colunas
-- novas (cada coluna de configuracoes exige grant de update próprio neste projeto, ver
-- CLAUDE.md). service_role já tem grant total (select/insert/update/delete) desde
-- 20260831100000_contrato_matricula.sql.
grant update (telegram_conecta_chat_id, tg_conecta_novo_candidato, tg_conecta_nova_empresa)
  on public.configuracoes to authenticated;
