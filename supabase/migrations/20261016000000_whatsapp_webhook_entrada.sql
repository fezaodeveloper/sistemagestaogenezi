-- NÃO APLICADA — aplicar manualmente pelo Supabase SQL Editor
--
-- Infraestrutura de webhook de entrada do WhatsApp (GênZap) — consumida por
-- src/app/api/webhooks/evolution/route.ts.
--
-- O check constraint da coluna whatsapp_fluxos.gatilho (que precisou aceitar
-- "primeira_mensagem" e "palavra_chave") NÃO foi alterado aqui: ele vive na migration
-- 20260924100000_whatsapp_fluxos.sql, que cria a tabela — editado direto lá (também ainda não
-- aplicada), em vez de um ALTER TABLE ... DROP/ADD CONSTRAINT redundante neste arquivo.

-- Sessões de conversa WhatsApp (um registro por número de telefone ativo)
-- Guarda o último fluxo em execução aguardando resposta do contato.
create table public.whatsapp_sessoes (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique,
  nome text,
  execucao_id uuid references public.whatsapp_fluxos_execucoes (id) on delete set null,
  aguardando_resposta boolean not null default false,
  ultima_mensagem_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice para lookup por telefone (o mais comum)
create index whatsapp_sessoes_telefone_idx on public.whatsapp_sessoes (telefone);

-- RLS: só service_role acessa (webhook roda com admin client)
alter table public.whatsapp_sessoes enable row level security;

-- Log de mensagens recebidas (para debug e auditoria)
create table public.whatsapp_mensagens_recebidas (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  nome_contato text,
  mensagem text not null,
  tipo text not null default 'texto' check (tipo in ('texto', 'audio', 'imagem', 'documento', 'outro')),
  payload_bruto jsonb,
  processado boolean not null default false,
  processado_em timestamptz,
  created_at timestamptz not null default now()
);

create index whatsapp_mensagens_recebidas_telefone_idx
  on public.whatsapp_mensagens_recebidas (telefone, created_at desc);

alter table public.whatsapp_mensagens_recebidas enable row level security;

-- Painel /admin/whatsapp-mensagens (lê com createClient(), não service_role) — mesmo padrão de
-- log_webhooks_asaas/eventos_automacao: policy de select pra admin + grant de select pra
-- authenticated (só policy não basta, grant de tabela acontece ANTES da RLS ser avaliada).
create policy "Admins podem ver mensagens recebidas"
  on public.whatsapp_mensagens_recebidas for select using (public.is_admin());

-- service_role bypassa RLS, mas NÃO bypassa grants de tabela (ver CLAUDE.md) — sem isso, o
-- webhook (que grava com createAdminClient, service_role) falharia com "permission denied for
-- table" em todo insert/update, exatamente o bug já documentado pra turmas/cursos/matriculas.
-- whatsapp_sessoes continua sem grant pra "authenticated": nenhuma tela admin lê/escreve essa
-- tabela ainda (diferente de whatsapp_mensagens_recebidas, que agora tem o painel acima).
grant select, insert, update, delete on public.whatsapp_sessoes to service_role;
grant select, insert, update, delete on public.whatsapp_mensagens_recebidas to service_role;
grant select on public.whatsapp_mensagens_recebidas to authenticated;

-- Coluna na tabela de execuções para marcar que está aguardando resposta do contato
alter table public.whatsapp_fluxos_execucoes
  add column if not exists aguardando_resposta boolean not null default false,
  add column if not exists resposta_recebida text;
