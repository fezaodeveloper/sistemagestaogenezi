-- Configuração da integração de SMS (IntegraX) — Configurações > Apps > IntegraX SMS.
--
-- Uma única linha (singleton): o id é fixo e o check impede criar outra. O app faz
-- upsert por esse id. `token` é guardado CRIPTOGRAFADO pelo app (AES-256-GCM,
-- prefixo "enc:v1:", chave GATEWAYS_ENCRYPTION_KEY — ver src/lib/gateways/crypto.ts)
-- e nunca volta pra tela depois de salvo.
--
-- Sem "created_by" (convenção padrão de toda tabela nova, CLAUDE.md): é uma linha
-- singleton semeada por esta migration, sem sessão autenticada por trás
-- ("auth.uid()" seria null) — mesma exceção de configuracoes e gateways_config.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.integracoes_sms_config (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid
    check (id = '00000000-0000-0000-0000-000000000001'::uuid),
  token text,
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_integracoes_sms_config_updated
  before update on public.integracoes_sms_config
  for each row execute function public.handle_updated_at();

-- ===== RLS: só admin =====

alter table public.integracoes_sms_config enable row level security;

create policy "Admins gerenciam integração de SMS"
  on public.integracoes_sms_config for all
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Grants =====

grant select, insert, update, delete on public.integracoes_sms_config to authenticated;
-- service_role bypassa RLS mas não os grants: o envio de SMS roda em webhooks de
-- gateway e formulários públicos, sem sessão de usuário.
grant select, insert, update, delete on public.integracoes_sms_config to service_role;

-- Linha inicial (inativa, sem token).
insert into public.integracoes_sms_config (id) values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
