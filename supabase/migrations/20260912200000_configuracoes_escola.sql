-- Dados da escola (exibidos em certificados/comprovantes no futuro) e
-- preferências de notificação do sino do admin.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  add column if not exists escola_nome text default 'GÊNEZI Educação Profissional',
  add column if not exists escola_cnpj text,
  add column if not exists escola_telefone text,
  add column if not exists escola_email text,
  add column if not exists escola_endereco text,
  add column if not exists escola_cidade text,
  add column if not exists escola_estado text,
  add column if not exists escola_cep text,
  add column if not exists escola_site text,
  add column if not exists notif_financeiro_atrasado boolean default true,
  add column if not exists notif_certificados_pendentes boolean default true,
  add column if not exists notif_eventos_hoje boolean default true,
  add column if not exists notif_eventos_amanha boolean default true;

-- SELECT já é liberado pra authenticated na tabela toda desde
-- 20260821100000_create_pontos_gamificacao.sql (sem lista de colunas) — só
-- falta o GRANT de UPDATE pras colunas novas (updated_by já tem UPDATE
-- concedido desde a mesma migration original, não precisa repetir aqui).
grant update (
  escola_nome, escola_cnpj, escola_telefone, escola_email,
  escola_endereco, escola_cidade, escola_estado, escola_cep, escola_site,
  notif_financeiro_atrasado, notif_certificados_pendentes,
  notif_eventos_hoje, notif_eventos_amanha
) on public.configuracoes to authenticated;
