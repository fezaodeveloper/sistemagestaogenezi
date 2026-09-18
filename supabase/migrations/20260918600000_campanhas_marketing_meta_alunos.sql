-- Campanhas de marketing: campo "Meta de alunos" + grants das páginas de
-- campanha (toggle Ativar/Desativar).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== 1. Meta de alunos =====
-- Nullable: campanhas antigas (e as que não têm meta) continuam válidas.
alter table public.campanhas_marketing
  add column if not exists meta_alunos integer
    check (meta_alunos is null or meta_alunos >= 0);

-- ===== 2. Grants de campanha_paginas (Páginas de Campanha) =====
-- A migration original (20260918100000_campanhas_paginas.sql) só concedeu
-- `select` em campanha_paginas para `authenticated` (e depois só o update da
-- coluna cor_fonte). Ou seja: o botão Ativar/Desativar, criar, editar,
-- duplicar e excluir página rodam como `authenticated` e são negados pelo
-- Postgres ("permission denied for table campanha_paginas") antes mesmo da
-- RLS — que já restringe tudo a is_admin() ("Admins gerenciam páginas de
-- campanha"). Idempotente: se esses grants já foram aplicados à mão no banco,
-- rodar de novo não muda nada.
grant insert, update, delete on public.campanha_paginas to authenticated;
