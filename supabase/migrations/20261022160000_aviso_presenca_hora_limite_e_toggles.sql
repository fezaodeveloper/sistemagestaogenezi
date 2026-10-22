-- NÃO APLICADA

-- Campos novos adicionados:
-- configuracoes.telegram_aviso_presenca_ativo (boolean, default true) — liga/desliga o aviso de
--   presença via Telegram (cron aviso-presenca) por completo.
-- configuracoes.telegram_aviso_presenca_hora_limite (time, default '23:59:00') — só turmas com
--   horario_aula <= esse valor disparam o aviso. Default bem tarde (23:59) de propósito: até o
--   admin configurar algo mais estrito, o comportamento continua igual ao de antes (todas as
--   turmas do dia avisam), sem quebrar nada em produção por causa de um default ausente.
-- configuracoes.tg_aluno_cadastrado, tg_evasao_risco, tg_contrato_pendente,
--   tg_parcela_vencendo_amanha (boolean, default true cada) — 4 notificações Telegram que já
--   existem no código (notificarAlunoCadastrado, notificarEvasaoRisco, notificarContratoPendente,
--   notificarParcelaVencendoAmanha em src/lib/automacoes/handlers/telegram.ts) mas nunca tiveram
--   toggle — ver auditoria da tarefa. Mesmo padrão de default true das tg_* colunas já
--   existentes (TELEGRAM_NOTIF_CHAVES): falha de leitura cai pro default "habilitado" via
--   src/lib/telegram/verificar-toggle.ts, nunca silencia notificação que já funcionava antes.

alter table public.configuracoes
  add column if not exists telegram_aviso_presenca_ativo boolean not null default true,
  add column if not exists telegram_aviso_presenca_hora_limite time not null default '23:59:00',
  add column if not exists tg_aluno_cadastrado boolean not null default true,
  add column if not exists tg_evasao_risco boolean not null default true,
  add column if not exists tg_contrato_pendente boolean not null default true,
  add column if not exists tg_parcela_vencendo_amanha boolean not null default true;

grant update (
  telegram_aviso_presenca_ativo,
  telegram_aviso_presenca_hora_limite,
  tg_aluno_cadastrado,
  tg_evasao_risco,
  tg_contrato_pendente,
  tg_parcela_vencendo_amanha
) on public.configuracoes to authenticated;
