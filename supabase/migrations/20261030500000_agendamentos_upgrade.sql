-- TAREFA agendamentos 2.4 — ver resumo da tarefa pras PERGUNTAS DE FATO e os desvios abaixo.
--
-- DESVIOS DO SQL ORIGINAL DA TAREFA:
--
-- 1) responsavel_id referencia public.profiles(id), não auth.users(id) — todo FK de "quem" já
--    existente no projeto (created_by, etc.) referencia profiles, nunca auth.users diretamente
--    (ver CLAUDE.md). profiles.id É o id de auth.users (1:1), então o efeito é o mesmo, mas fica
--    consistente com o resto do schema (e com o select de nome pra popular o <select> do admin).
--
-- 2) NÃO adiciona `lembrete_1d_enviado`, `lembrete_2h_enviado` nem repete `motivo_cancelamento`:
--    - motivo_cancelamento JÁ EXISTE desde 20261015100000_add_motivo_cancelamento_agendamento.sql
--      (PERGUNTA DE FATO 1 do resumo) — reafirmar aqui só duplicaria uma migration já escrita.
--    - o lembrete D-1 JÁ FUNCIONA de ponta a ponta hoje: cron /api/cron/lembrete-agendamentos
--      (schedule diário 21:00 UTC / 18h BRT, já no vercel.json) chama
--      notificarWhatsappAgendamentoLembrete (src/lib/whatsapp/eventos.ts) + SMS + Telegram, e já
--      usa a coluna `lembrete_enviado` (da migration original) como flag de "já mandei". Criar
--      `lembrete_1d_enviado` do zero recriaria esse mesmo mecanismo em paralelo, arriscando
--      mandar o lembrete D-1 DUAS VEZES (uma pela flag antiga, outra pela nova) sem motivo.
--    - `lembrete_2h_enviado` CHEGOU A EXISTIR aqui numa versão anterior desta migration (junto
--      com um cron hourly, /api/cron/lembretes-agendamento) e foi REMOVIDA: o plano Vercel Hobby
--      só permite crons 1x/dia, então um lembrete de "2h antes" de verdade não é viável. Em vez
--      disso, {local} e {link_gerenciar} (que esse lembrete levaria) entraram direto no template
--      "agendamento_lembrete" do lembrete D-1 que já existe (ver src/lib/whatsapp/eventos.ts) —
--      nenhuma coluna nova precisa ficar nesta migration por causa disso.

alter table public.agendamento_paginas
  add column if not exists responsavel_id uuid references public.profiles (id) on delete set null,
  add column if not exists local_atendimento text,
  add column if not exists antecedencia_maxima_dias integer not null default 30,
  add column if not exists intervalo_entre_horarios integer not null default 0,
  add column if not exists feriados_bloqueados date[] not null default '{}',
  add column if not exists datas_bloqueadas date[] not null default '{}';

alter table public.agendamentos
  add column if not exists email text,
  add column if not exists remarcado_de uuid references public.agendamentos (id) on delete set null,
  add column if not exists cancelado_por text check (cancelado_por in ('admin', 'cliente'));

create index if not exists idx_agendamentos_data on public.agendamentos (data_agendada);
create index if not exists idx_agendamentos_status on public.agendamentos (status);

-- Sem grant novo: 20260918400000_agendamentos_grants_admin.sql já concede update/select na
-- tabela inteira (sem lista de colunas) pra authenticated/service_role — cobre as colunas novas
-- automaticamente, mesmo padrão já documentado em 20261015100000.

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
