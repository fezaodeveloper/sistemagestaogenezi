-- Base do sistema de gateways de pagamento (Asaas, Stripe, Pagar.me,
-- Mercado Pago, Efí). Uma linha por gateway, com credenciais, taxas e o flag
-- "ativo" (no máximo UM gateway ativo por vez).
--
-- Sem "created_by" (convenção padrão de toda tabela nova, CLAUDE.md): a linha do
-- Asaas é semente desta migration (sem sessão autenticada por trás, "auth.uid()"
-- seria null e quebraria um "not null default auth.uid()") — mesma exceção já
-- documentada em termos_legais e conecta_cidades.
--
-- credenciais: jsonb { "<campo>": "<valor>" }. O APP grava cada valor
-- CRIPTOGRAFADO (AES-256-GCM, prefixo "enc:v1:", chave GATEWAYS_ENCRYPTION_KEY
-- no ambiente — ver src/lib/gateways/crypto.ts). Valor sem esse prefixo é lido
-- como texto puro (é o caso da semente abaixo, se copiada de uma coluna antiga)
-- e passa a ser criptografado na próxima vez que o admin salvar o gateway.
--
-- taxas: jsonb { pix_percentual, cartao_percentual, cartao_fixo,
-- boleto_percentual, boleto_fixo } — todas opcionais.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.gateways_config (
  id uuid primary key default gen_random_uuid(),
  -- unique: uma linha por gateway (o app faz upsert por este campo).
  gateway text not null unique
    check (gateway in ('asaas', 'stripe', 'pagarme', 'mercadopago', 'efi')),
  ativo boolean not null default false,
  sandbox boolean not null default false,
  credenciais jsonb not null default '{}'::jsonb
    check (jsonb_typeof(credenciais) = 'object'),
  taxas jsonb not null default '{}'::jsonb
    check (jsonb_typeof(taxas) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo um gateway com ativo = true: índice único parcial sobre uma
-- expressão constante — duas linhas ativas teriam a mesma chave (true) e a
-- segunda seria recusada pelo banco, não só pela tela.
create unique index gateways_config_um_ativo_idx
  on public.gateways_config ((true))
  where ativo;

create trigger on_gateways_config_updated
  before update on public.gateways_config
  for each row execute function public.handle_updated_at();

-- ===== RLS: só admin vê e modifica =====

alter table public.gateways_config enable row level security;

create policy "Admins gerenciam gateways"
  on public.gateways_config for all
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Grants =====

grant select, insert, update, delete on public.gateways_config to authenticated;
-- service_role bypassa RLS mas não os grants: webhooks, crons e Server Actions
-- que cobram via Asaas leem a chave daqui com o client admin (sem sessão).
grant select, insert, update, delete on public.gateways_config to service_role;

-- ===== Seed: Asaas ativo =====
--
-- A tarefa pedia copiar "configuracoes.asaas_api_key", mas esse campo NÃO existe
-- nas migrations do projeto: hoje a chave do Asaas vive só na variável de
-- ambiente ASAAS_API_KEY (src/lib/asaas/client.ts). Por isso:
--   1) se alguém criou a coluna à mão no banco, a chave é copiada dela;
--   2) senão as credenciais ficam vazias e o app CONTINUA usando ASAAS_API_KEY
--      (fallback do adapter) — o Asaas não para de funcionar. O admin pode
--      colar a chave em /admin/configuracoes/gateways quando quiser migrá-la.

do $$
declare
  v_chave text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracoes'
      and column_name = 'asaas_api_key'
  ) then
    execute 'select asaas_api_key from public.configuracoes limit 1' into v_chave;
  end if;

  insert into public.gateways_config (gateway, ativo, sandbox, credenciais)
  values (
    'asaas',
    true,
    false,
    case
      when nullif(btrim(v_chave), '') is not null
        then jsonb_build_object('apiKey', btrim(v_chave))
      else '{}'::jsonb
    end
  )
  on conflict (gateway) do nothing;
end
$$;
