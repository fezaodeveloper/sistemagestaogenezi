-- Toggles de notificações do Telegram (aba Configurações > Notificações, admin).
-- Todos habilitados por padrão (true) — comportamento igual ao de hoje até o admin desligar algum.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  -- Financeiro
  add column if not exists tg_matricula_criada boolean not null default true,
  add column if not exists tg_pagamento_confirmado boolean not null default true,
  add column if not exists tg_pagamento_atrasado boolean not null default true,
  add column if not exists tg_cobranca_gerada boolean not null default true,
  add column if not exists tg_resumo_financeiro_diario boolean not null default true,

  -- Alunos / LMS
  add column if not exists tg_curso_concluido boolean not null default true,
  add column if not exists tg_certificado_gerado boolean not null default true,
  add column if not exists tg_aluno_sem_acesso boolean not null default true,
  add column if not exists tg_nota_reprovacao boolean not null default true,
  add column if not exists tg_frequencia_baixa boolean not null default true,

  -- Leads / CRM
  add column if not exists tg_lead_criado boolean not null default true,
  add column if not exists tg_lead_convertido boolean not null default true,
  add column if not exists tg_lead_sem_followup boolean not null default true,

  -- Prêmios
  add column if not exists tg_premio_resgatado boolean not null default true,
  add column if not exists tg_estoque_baixo boolean not null default true,

  -- Agendamentos
  add column if not exists tg_agendamento_criado boolean not null default true,
  add column if not exists tg_agendamento_cancelado boolean not null default true,
  add column if not exists tg_lembrete_agendamento boolean not null default true,

  -- Relatórios
  add column if not exists tg_relatorio_frequencia boolean not null default true,
  add column if not exists tg_relatorio_semanal boolean not null default true,

  -- Gênezi Conecta
  add column if not exists tg_conecta_nova_postagem boolean not null default true,
  add column if not exists tg_conecta_novo_comentario boolean not null default true;

-- SELECT já é liberado pra authenticated na tabela toda (sem lista de colunas) desde
-- 20260821100000_create_pontos_gamificacao.sql — só falta o GRANT de UPDATE pras colunas novas
-- (mesmo padrão de 20260917400000_configuracoes_conecta_habilitado.sql). service_role já tem
-- grant total (select/insert/update/delete) desde 20260831100000_contrato_matricula.sql — é ele
-- quem src/lib/telegram/verificar-toggle.ts usa (client admin) pra checar esses toggles sem
-- depender de sessão de admin logado (as automações rodam em background/cron, não numa request
-- autenticada do painel).
grant update (
  tg_matricula_criada, tg_pagamento_confirmado, tg_pagamento_atrasado, tg_cobranca_gerada,
  tg_resumo_financeiro_diario, tg_curso_concluido, tg_certificado_gerado, tg_aluno_sem_acesso,
  tg_nota_reprovacao, tg_frequencia_baixa, tg_lead_criado, tg_lead_convertido,
  tg_lead_sem_followup, tg_premio_resgatado, tg_estoque_baixo, tg_agendamento_criado,
  tg_agendamento_cancelado, tg_lembrete_agendamento, tg_relatorio_frequencia,
  tg_relatorio_semanal, tg_conecta_nova_postagem, tg_conecta_novo_comentario
) on public.configuracoes to authenticated;
