-- CRM 2.1 — leads profissionalizado: novos campos de contato/atribuição, FK real pra
-- campanhas_marketing (ver AUDITORIA: campanha_origem era só texto livre, sem ligação de
-- verdade com a tabela de campanhas), e histórico de atividades (lead_historico).
--
-- Desvios do SQL pedido na TAREFA:
-- 1. responsavel_id e lead_historico.usuario_id referenciam public.profiles(id), não
--    auth.users(id) — convenção do projeto (CLAUDE.md): toda FK de "quem fez a ação" aponta
--    pra profiles, nunca direto pra auth.users (profiles.id = auth.users.id, 1:1, mas a tabela
--    de aplicação é profiles).
-- 2. A policy de lead_historico pedida era `for all to authenticated using (true)` — sem
--    filtro nenhum, qualquer autenticado (aluno, empresa) conseguiria ler/escrever histórico de
--    lead. Trocada por `using (public.is_admin())`, mesmo padrão de TODAS as outras tabelas
--    deste módulo (leads, kanban_colunas, campanhas_marketing, agendamentos, etc.).
-- 3. GRANTs adicionados pras colunas novas de leads: a migration original
--    (20260902100000_create_leads.sql) e a do Kanban (20260917900000) usam grant POR COLUNA
--    pra authenticated (não um grant amplo de tabela) — sem repetir esse padrão aqui, o
--    INSERT/UPDATE dos campos novos pelo client autenticado normal falharia com "permission
--    denied for column".
-- 4. lead_historico SEM created_by (convenção CLAUDE.md teria "created_by not null default
--    auth.uid()") — usuario_id é nullable de propósito, igual ao padrão já usado em
--    email_campanhas_envios: várias linhas nascem de processos sem sessão (cron de follow-up,
--    trigger de matrícula movendo o card), não só de uma ação do admin logado.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== Novos campos em leads =====

alter table public.leads
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists campanha_id uuid references public.campanhas_marketing (id) on delete set null,
  add column if not exists responsavel_id uuid references public.profiles (id) on delete set null,
  add column if not exists proximo_contato timestamptz,
  add column if not exists motivo_perda text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists idx_leads_proximo_contato on public.leads (proximo_contato);
create index if not exists idx_leads_campanha_id on public.leads (campanha_id);
create index if not exists idx_leads_responsavel_id on public.leads (responsavel_id);

-- Grants por coluna (ver desvio 3 acima) — mesmo padrão das duas migrations anteriores de
-- leads. INSERT cobre o formulário de criar lead; UPDATE cobre edição manual + drawer do Kanban
-- (campanha_id/responsavel_id/proximo_contato/motivo_perda são editados só pelo drawer, nunca no
-- INSERT inicial, mas o grant de update já cobre).
grant insert (whatsapp, email, campanha_id, responsavel_id, proximo_contato, utm_source, utm_medium, utm_campaign)
  on public.leads to authenticated;
grant update (whatsapp, email, campanha_id, responsavel_id, proximo_contato, motivo_perda, observacoes)
  on public.leads to authenticated;

-- ===== Histórico real de atividades =====

create table public.lead_historico (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  tipo text not null check (tipo in (
    'criacao', 'status_alterado', 'coluna_alterada',
    'anotacao', 'agendamento', 'whatsapp', 'matricula'
  )),
  descricao text not null,
  coluna_anterior text,
  coluna_nova text,
  usuario_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_lead_historico_lead_id on public.lead_historico (lead_id);

alter table public.lead_historico enable row level security;

create policy "Admins gerenciam historico de leads"
  on public.lead_historico for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on public.lead_historico to authenticated;
grant select, insert, update, delete on public.lead_historico to service_role;
