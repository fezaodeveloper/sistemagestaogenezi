-- Páginas de campanha: tipografia e espaçamento configuráveis no editor
-- (aba Visual > "Tipografia e espaçamento").
--
-- JSON no formato:
--   {
--     "fonte": "sistema" | "inter" | "roboto" | "poppins" | "montserrat" | "open_sans",
--     "tamanho_titulo": 24-72,   -- px
--     "tamanho_texto": 12-24,    -- px
--     "espacamento": 8-48,       -- px entre seções
--     "peso_titulo": "normal" | "semibold" | "bold" | "extrabold"
--   }
--
-- O default é '{}' (objeto vazio): páginas existentes continuam com o visual
-- atual — o app preenche os valores padrão (fonte do sistema, título 30px,
-- texto 16px, espaçamento 24px, título em negrito) ao ler. Os limites e valores
-- válidos são validados no Zod (tipografiaSchema), não aqui — o banco só
-- garante que é um objeto JSON.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.campanha_paginas
  add column if not exists tipografia jsonb not null default '{}'::jsonb
    check (jsonb_typeof(tipografia) = 'object');

grant update (tipografia) on public.campanha_paginas to authenticated;
