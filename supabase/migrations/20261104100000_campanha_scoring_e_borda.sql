-- TAREFA campanha — PARTE 2 (pontuação) e PARTE 5 (cor da borda dos campos).
--
-- Dados do responsável (PARTE 8, menor de idade) NÃO entram aqui: ficam dentro do jsonb
-- `respostas` já existente (chaves reservadas _responsavel_nome/_responsavel_whatsapp/
-- _responsavel_cpf, ver src/lib/campanha-paginas/schema.ts), mesmo padrão de _aceite_lgpd/
-- _aceite_declaracao — não precisam de coluna nova.
--
-- SEM GRANT novo nesta migration (verificado antes de escrever, não é omissão): diferente do
-- padrão predominante em `alunos` (insert/update por coluna), `campanha_paginas` e
-- `campanha_respostas` já têm grant de TABELA INTEIRA pra authenticated/anon/service_role
-- (ver 20260918600000_campanhas_marketing_meta_alunos.sql: "grant insert, update, delete on
-- public.campanha_paginas to authenticated", e 20260918100000_campanhas_paginas.sql: "grant
-- select, insert on public.campanha_respostas to authenticated" / "grant insert ... to anon") —
-- um grant de tabela sem lista de colunas cobre qualquer coluna nova automaticamente, sem
-- precisar de um grant adicional por coluna. Os grants por coluna vistos em migrations
-- posteriores (cards_destaque, tipografia, cor_fonte) eram redundantes quando escritos, não um
-- padrão a replicar aqui.

alter table public.campanha_paginas
  add column if not exists habilitar_pontuacao boolean not null default false,
  add column if not exists pontuacao_maxima int not null default 100,
  add column if not exists pontuacao_minima_bolsa int not null default 70,
  add column if not exists cor_borda text;

alter table public.campanha_respostas
  add column if not exists pontuacao_total int,
  add column if not exists pontuacao_percentual numeric(5, 2);

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
