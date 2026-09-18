-- Cor de fonte configurável nas páginas de campanha (roadmap, item 1) — o
-- texto das opções A/B/C/D e outros elementos não tinha cor explícita,
-- ficando ilegível dependendo do tema/cor de fundo escolhidos.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.campanha_paginas
  add column if not exists cor_fonte text not null default '#ffffff';

grant update (cor_fonte) on public.campanha_paginas to authenticated;
