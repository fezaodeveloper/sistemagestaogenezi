-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Painel "Horários de Notificações" (/admin/configuracoes, aba Notificações): permite ajustar
-- quando os lembretes automáticos são enviados sem precisar alterar código. Mesmo padrão
-- aditivo das demais colunas de public.configuracoes (ADD COLUMN + default, sem recriar nada).

alter table public.configuracoes
  add column if not exists lembrete_aula_horas_antes integer not null default 24,
  add column if not exists lembrete_aula_hora_envio integer not null default 8,
  add column if not exists lembrete_aula_ativo boolean not null default true,
  add column if not exists lembrete_pagamento_dias_antes integer not null default 3,
  add column if not exists lembrete_pagamento_hora_envio integer not null default 9,
  add column if not exists lembrete_pagamento_ativo boolean not null default true;

comment on column public.configuracoes.lembrete_aula_horas_antes is
  'Quantas horas antes da aula enviar o lembrete (padrão: 24) — granularidade real é por dia, ver cron lembretes-aula';
comment on column public.configuracoes.lembrete_aula_hora_envio is
  'Hora do dia (0-23, horário de Brasília) em que o cron de lembrete de aula efetivamente dispara (padrão: 8)';
comment on column public.configuracoes.lembrete_aula_ativo is
  'Liga/desliga o envio automático de lembrete de aula';
comment on column public.configuracoes.lembrete_pagamento_dias_antes is
  'Dias de antecedência do vencimento para lembrete de pagamento (reservado — sem cron de "antes do vencimento" implementado ainda; hoje só existe o cron de cobrança ATRASADA)';
comment on column public.configuracoes.lembrete_pagamento_hora_envio is
  'Hora do dia (0-23, horário de Brasília) para o lembrete de pagamento (reservado, ver comentário acima)';
comment on column public.configuracoes.lembrete_pagamento_ativo is
  'Liga/desliga o lembrete de pagamento (reservado, ver comentário acima)';

-- select já é concedido na tabela inteira pra authenticated/service_role (sem restrição de
-- coluna, ver create_configuracoes) — só insert/update por coluna específica precisam de grant
-- novo, mesmo padrão das colunas pts_*/recurso_*.
grant update (
  lembrete_aula_horas_antes,
  lembrete_aula_hora_envio,
  lembrete_aula_ativo,
  lembrete_pagamento_dias_antes,
  lembrete_pagamento_hora_envio,
  lembrete_pagamento_ativo
) on public.configuracoes to authenticated;
