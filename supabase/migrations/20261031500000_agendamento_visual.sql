-- TAREFA agendamentos — PARTE 4: personalização visual do formulário público.

alter table public.agendamento_paginas
  add column if not exists config_visual jsonb not null default '{}';

-- Sem grant novo: 20260918400000_agendamentos_grants_admin.sql já concede update na tabela
-- inteira (sem lista de colunas) pra authenticated — cobre a coluna nova automaticamente.

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
