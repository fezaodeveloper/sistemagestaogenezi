-- Integrações com a Spedy (emissão automática de NFS-e) — Configurações > Apps >
-- Spedy NF-e. Pode haver mais de uma (ex.: uma empresa emissora por curso).
--
-- chave_api é guardada CRIPTOGRAFADA pelo app (AES-256-GCM, prefixo "enc:v1:", chave
-- GATEWAYS_ENCRYPTION_KEY — ver src/lib/gateways/crypto.ts) e nunca volta pra tela
-- depois de salva. A Spedy usa contas SEPARADAS pra sandbox e produção (chaves
-- diferentes), por isso `ambiente` é da integração e não global.
--
-- cursos_ids: vazio = todos os cursos; com ids, só pagamentos de matrículas em
-- turmas desses cursos. Sem FK (coluna array não tem): o app ignora ids de cursos
-- já excluídos. O app impede duas integrações ATIVAS cobrindo o mesmo curso (uma
-- nota só por pagamento).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.spedy_integracoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  chave_api text not null,
  ambiente text not null default 'sandbox'
    check (ambiente in ('sandbox', 'producao')),
  ativo boolean not null default false,
  cursos_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spedy_integracoes_ativo_idx on public.spedy_integracoes (ativo);

create trigger on_spedy_integracoes_updated
  before update on public.spedy_integracoes
  for each row execute function public.handle_updated_at();

-- ===== RLS: só admin =====

alter table public.spedy_integracoes enable row level security;

create policy "Admins gerenciam integrações Spedy"
  on public.spedy_integracoes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Grants =====

grant select, insert, update, delete on public.spedy_integracoes to authenticated;
-- A emissão automática roda em webhooks de gateway (sem sessão) com o client admin.
grant select, insert, update, delete on public.spedy_integracoes to service_role;
