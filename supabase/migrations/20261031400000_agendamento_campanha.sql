-- TAREFA agendamentos — PARTE 3: vincular página de agendamento a uma página de campanha.
--
-- DESVIO DO SQL ORIGINAL — ver resumo da tarefa: a PARTE 3 pedia "ao criar lead via
-- agendamento, passar campanha_id pro lead criado", mas `leads.campanha_id` referencia
-- public.campanhas_marketing (CRM 2.1, 20261030200000_leads_crm_upgrade.sql) — uma tabela
-- DIFERENTE de campanha_paginas (o construtor de landing pages, Fase de campanha 2.5). Gravar o
-- id de campanha_paginas ali violaria a FK (ou, pior, corromperia o dado se por acaso existisse
-- outro registro com o mesmo id). O lead passa a receber `campanha_origem` (texto, já existente
-- e já usado exatamente pra isso por campanha/[slug]/actions.ts quando o lead nasce de uma
-- campanha sem relação de FK com `leads.campanha_id`) com o título da página de agendamento.

alter table public.agendamento_paginas
  add column if not exists campanha_id uuid references public.campanha_paginas (id) on delete set null;

create index if not exists idx_agendamento_paginas_campanha_id on public.agendamento_paginas (campanha_id);

-- Sem grant novo: 20260918400000_agendamentos_grants_admin.sql já concede update na tabela
-- inteira (sem lista de colunas) pra authenticated — cobre a coluna nova automaticamente.

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
