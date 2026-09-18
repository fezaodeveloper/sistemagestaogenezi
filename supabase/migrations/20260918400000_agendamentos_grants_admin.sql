-- Kanban de agendamentos + duplicar/excluir página + reagendar (roadmap,
-- item 2) — grants que faltavam para o role `authenticated`.
--
-- A migration original (20260918000000_agendamentos.sql) só concedeu:
--   * agendamento_paginas: select
--   * agendamentos:        select, insert
-- Só que as policies "Admins gerenciam ..." (for all using is_admin()) já
-- permitem update/delete/insert para admin — sem o grant de tabela abaixo o
-- Postgres nega antes mesmo de avaliar a RLS ("permission denied for table").
-- Precisam disso:
--   * agendamentos (update):        arrastar card entre colunas (status) e
--                                   reagendar (data_agendada/horario)
--   * agendamentos (delete):        excluir agendamento pelo card do Kanban
--   * agendamento_paginas (insert): criar e duplicar página
--   * agendamento_paginas (update): editar e ativar/desativar página
--   * agendamento_paginas (delete): excluir página
--
-- Idempotente: se esses grants já foram aplicados manualmente no banco, rodar
-- de novo não muda nada. A RLS continua restringindo tudo a is_admin() — quem
-- não é admin não passa pelas policies mesmo com o grant de tabela.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

grant update, delete on public.agendamentos to authenticated;
grant insert, update, delete on public.agendamento_paginas to authenticated;
