-- Integrações do módulo Comercial (TAREFA CRM 2.2): agendamento público e página de campanha
-- passam a criar/associar lead de verdade, com UTM tracking na resposta da campanha.
--
-- Ajustes sobre o SQL pedido na TAREFA:
-- 1. leads.curso_id era NOT NULL desde a criação da tabela (20260902100000_create_leads.sql) —
--    PARTE 2 pede lead sem curso quando a página de campanha não tem curso vinculado, então a
--    coluna precisa ficar nullable (confirmado na PERGUNTA DE FATO 1).
-- 2. lead_origem é um TYPE enum de verdade (não CHECK), mesmo padrão já usado pra adicionar o
--    valor 'campanha' em 20260918100000_campanhas_paginas.sql — 'agendamento' entra do mesmo
--    jeito, não precisou do fallback pra 'campanha' que a TAREFA previu como plano B.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- FK original (on delete restrict) mantida como está — só a obrigatoriedade do valor muda,
-- não o comportamento de exclusão de curso.
alter table public.leads alter column curso_id drop not null;

alter type public.lead_origem add value if not exists 'agendamento';

alter table public.agendamentos
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

alter table public.campanha_respostas
  add column if not exists lead_id uuid references public.leads (id) on delete set null,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists idx_agendamentos_lead_id on public.agendamentos (lead_id);
create index if not exists idx_campanha_respostas_lead_id on public.campanha_respostas (lead_id);

-- Sem GRANT novo: as duas tabelas são escritas pelo client admin (service_role) nas Server
-- Actions públicas (ver criarAgendamentoPublico/enviarRespostaCampanha) — service_role já tem
-- select/insert/update/delete amplo em ambas desde a criação.
