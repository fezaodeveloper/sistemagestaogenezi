-- TAREFA auditoria de notificações — ver resumo da tarefa pras PERGUNTAS DE FATO e os desvios
-- abaixo.
--
-- DESVIO DO SQL ORIGINAL DA TAREFA: NÃO cria uma tabela nova `notificacoes_log`. Já existe
-- `public.mensagens_enviadas` (Fase 13 + CRM, ver 20260831100000_create_mensagens_whatsapp.sql e
-- 20260902100000_create_leads.sql) fazendo exatamente esse papel — log de todo envio de WhatsApp
-- com tipo/matricula_id/lead_id/telefone_destino/status/erro_detalhe/created_by/created_at.
-- `created_by` (uuid, nullable) já cobre "enviado_por": null = cron/sistema, preenchido = clique
-- manual do admin — não precisa de uma coluna texto `enviado_por` redundante que pudesse
-- divergir dela.
--
-- O que falta de verdade pra essa tabela virar o log UNIFICADO que a tarefa quer: ela só aceita
-- 4 tipos (matricula_criada/lembrete_aula/falta/lead_recontato, enum `mensagem_whatsapp_tipo`) —
-- os envios de WhatsApp disparados pelos crons de agendamento/cobrança/lead-followup (ver
-- src/lib/whatsapp/eventos.ts) nunca passam por ela, não tinham tipo nem onde logar. Esta
-- migration só ADICIONA os 3 valores de enum que esses crons precisam — nenhuma tabela nova,
-- nenhuma coluna removida, nada que afete os 4 tipos já existentes.

alter type public.mensagem_whatsapp_tipo add value if not exists 'agendamento_lembrete';
alter type public.mensagem_whatsapp_tipo add value if not exists 'cobranca_atrasada';
alter type public.mensagem_whatsapp_tipo add value if not exists 'lead_followup';

-- Índice de apoio pro painel de auditoria (PARTE 3): filtros por período/tipo sobre toda a
-- tabela, sem o índice parcial existente (mensagens_enviadas_status_idx só cobre status='falha').
create index if not exists idx_mensagens_enviadas_tipo_created on public.mensagens_enviadas (tipo, created_at desc);
create index if not exists idx_mensagens_enviadas_created on public.mensagens_enviadas (created_at desc);

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
