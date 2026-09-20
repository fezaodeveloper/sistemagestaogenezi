-- Configuração do servidor de e-mail (Configurações > E-mail > Provedor): qual
-- provedor envia (Resend, SMTP ou SendGrid) e as credenciais de cada um.
--
-- Singleton: o id é fixo e o check impede outra linha (o app faz upsert por ele).
-- Todos os segredos (resend_api_key, smtp_senha, sendgrid_api_key) são guardados
-- CRIPTOGRAFADOS pelo app (AES-256-GCM, prefixo "enc:v1:", chave
-- GATEWAYS_ENCRYPTION_KEY — ver src/lib/gateways/crypto.ts) e nunca voltam pra tela.
--
-- O Resend já em uso NÃO muda: sem chave salva aqui (resend_api_key vazia), o app
-- continua usando RESEND_API_KEY / RESEND_FROM_EMAIL do ambiente, exatamente como
-- antes. Só passa a usar outro provedor se o admin escolher.
--
-- Além das colunas pedidas, há resend_from_name / resend_from_email: a tela também
-- pede o remetente do Resend. Sem "created_by" (convenção CLAUDE.md): singleton
-- semeado por migration, sem sessão por trás.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.email_config (
  id uuid primary key default '00000000-0000-0000-0000-000000000002'::uuid
    check (id = '00000000-0000-0000-0000-000000000002'::uuid),
  provedor text not null default 'resend'
    check (provedor in ('resend', 'smtp', 'sendgrid')),

  resend_api_key text,
  resend_from_name text,
  resend_from_email text,

  smtp_host text,
  smtp_porta integer default 587 check (smtp_porta is null or smtp_porta between 1 and 65535),
  smtp_usuario text,
  smtp_senha text,
  smtp_ssl boolean default true,
  smtp_from_name text,
  smtp_from_email text,

  sendgrid_api_key text,
  sendgrid_from_name text,
  sendgrid_from_email text,

  updated_at timestamptz not null default now()
);

create trigger on_email_config_updated
  before update on public.email_config
  for each row execute function public.handle_updated_at();

alter table public.email_config enable row level security;

create policy "Admins gerenciam config de e-mail"
  on public.email_config for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.email_config to authenticated;
-- O envio roda em webhooks e formulários públicos, sem sessão (client admin).
grant select, insert, update, delete on public.email_config to service_role;

insert into public.email_config (id, provedor) values ('00000000-0000-0000-0000-000000000002', 'resend')
on conflict (id) do nothing;
