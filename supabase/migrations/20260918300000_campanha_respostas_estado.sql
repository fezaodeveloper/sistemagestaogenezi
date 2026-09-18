-- Seletor Estado/Cidade na tela inicial do formulário da campanha pública.
--
-- `campanha_respostas.cidade` já existe (text, nullable — ver
-- 20260918100000_campanhas_paginas.sql); só falta o estado (UF). Sem
-- necessidade de novo grant: o `grant insert` para anon/authenticated e o
-- `grant ... to service_role` dessa tabela já são em nível de tabela, então
-- cobrem colunas novas automaticamente.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.campanha_respostas
  add column if not exists estado varchar(2);
