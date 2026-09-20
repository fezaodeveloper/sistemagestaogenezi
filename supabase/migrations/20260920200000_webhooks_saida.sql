-- Webhooks de SAÍDA (Configurações > Apps > Webhooks): o admin cadastra URLs e o
-- sistema faz POST nelas quando certos eventos acontecem (matrícula criada,
-- pedido pago, lead criado...). Não confundir com api/webhooks/* (que RECEBEM
-- avisos dos gateways de pagamento).
--
-- webhooks_config — uma linha por destino. bearer_token é guardado CRIPTOGRAFADO
-- pelo app (AES-256-GCM, prefixo "enc:v1:", mesma chave GATEWAYS_ENCRYPTION_KEY
-- das credenciais de gateways — ver src/lib/gateways/crypto.ts) e nunca volta pra
-- tela depois de salvo.
--
-- webhooks_log — uma linha por (webhook, evento) disparado, atualizada a cada
-- tentativa. Só o servidor (service_role) escreve; o admin lê.
--
-- Sem "created_by" em webhooks_log (convenção padrão de toda tabela nova,
-- CLAUDE.md): as linhas nascem de eventos do sistema, sem usuário por trás
-- (webhook de gateway, formulário público) — "auth.uid()" seria null. Em
-- webhooks_config, escrita só por admin, o created_by vale normalmente.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.webhooks_config (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url text not null,
  bearer_token text,
  eventos text[] not null default '{}'
    check (
      eventos <@ array[
        'pedido_pendente', 'pedido_pago', 'acesso_enviado', 'pagamento_recusado',
        'pedido_cancelado', 'matricula_criada', 'agendamento_criado', 'lead_criado'
      ]::text[]
    ),
  -- Vazio = todos os cursos. Sem FK (uma coluna array não tem): o app filtra por
  -- payload.curso_id e ignora ids de cursos que já foram excluídos.
  cursos_ids uuid[] not null default '{}',
  ativo boolean not null default true,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Busca de "webhooks ativos que assinam o evento X" (contains no array).
create index webhooks_config_eventos_idx on public.webhooks_config using gin (eventos) where ativo;

create trigger on_webhooks_config_updated
  before update on public.webhooks_config
  for each row execute function public.handle_updated_at();

create table public.webhooks_log (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks_config (id) on delete cascade,
  evento text not null,
  payload jsonb not null,
  status text not null default 'pendente'
    check (status in ('entregue', 'falhou', 'pendente')),
  tentativas integer not null default 0,
  resposta_status integer,
  resposta_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhooks_log_webhook_id_created_at_idx on public.webhooks_log (webhook_id, created_at desc);
create index webhooks_log_created_at_idx on public.webhooks_log (created_at desc);

create trigger on_webhooks_log_updated
  before update on public.webhooks_log
  for each row execute function public.handle_updated_at();

-- ===== RLS: só admin =====

alter table public.webhooks_config enable row level security;
alter table public.webhooks_log enable row level security;

create policy "Admins gerenciam webhooks"
  on public.webhooks_config for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins gerenciam logs de webhooks"
  on public.webhooks_log for all
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Grants =====

grant select, insert, update, delete on public.webhooks_config to authenticated;
grant select, insert, update, delete on public.webhooks_log to authenticated;
-- service_role bypassa RLS mas não os grants: quem dispara (webhooks de gateway,
-- formulários públicos) roda sem sessão de usuário, com o client admin.
grant select, insert, update, delete on public.webhooks_config to service_role;
grant select, insert, update, delete on public.webhooks_log to service_role;
