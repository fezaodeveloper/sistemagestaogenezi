-- Módulo financeiro: parcelas de matrícula (com integração Asaas),
-- pagamentos avulsos, gastos da escola e log de webhooks Asaas.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== parcelas =====

create table public.parcelas (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  numero_parcela integer not null check (numero_parcela >= 1),
  valor numeric(10,2) not null,
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente'
    check (status in ('pendente','pago','atrasado','cancelado','estornado')),
  forma_pagamento text check (forma_pagamento in ('boleto','pix','cartao','avista','outro')),
  asaas_payment_id text,
  asaas_invoice_url text,
  asaas_bank_slip_url text,
  asaas_status text,
  observacoes text,
  -- created_by aqui é sempre o admin que gera a parcela (manual) ou a
  -- trigger/Server Action de criação de matrícula rodando como admin —
  -- nenhum papel aluno insere nessa tabela, então o FK padrão (sem cascade)
  -- é seguro, mesmo critério documentado no CLAUDE.md.
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matricula_id, numero_parcela)
);

create index parcelas_matricula_id_idx on public.parcelas (matricula_id);
create index parcelas_aluno_id_idx on public.parcelas (aluno_id);
create index parcelas_status_idx on public.parcelas (status);
create index parcelas_data_vencimento_idx on public.parcelas (data_vencimento);
create index parcelas_asaas_payment_id_idx on public.parcelas (asaas_payment_id);

alter table public.parcelas enable row level security;

create policy "Admins podem ver parcelas"
  on public.parcelas for select using (public.is_admin());

create policy "Alunos podem ver as próprias parcelas"
  on public.parcelas for select using (aluno_id = auth.uid());

create policy "Admins podem criar parcelas"
  on public.parcelas for insert with check (public.is_admin());

create policy "Admins podem atualizar parcelas"
  on public.parcelas for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir parcelas"
  on public.parcelas for delete using (public.is_admin());

create trigger on_parcelas_updated
  before update on public.parcelas
  for each row execute function public.handle_updated_at();

grant select on public.parcelas to authenticated;
grant insert (
  matricula_id, aluno_id, numero_parcela, valor, data_vencimento, data_pagamento,
  status, forma_pagamento, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url,
  asaas_status, observacoes
) on public.parcelas to authenticated;
grant update (
  data_pagamento, status, forma_pagamento, asaas_payment_id, asaas_invoice_url,
  asaas_bank_slip_url, asaas_status, observacoes, valor, data_vencimento
) on public.parcelas to authenticated;
grant delete on public.parcelas to authenticated;
grant select, insert, update, delete on public.parcelas to service_role;

-- ===== pagamentos_avulsos =====

create table public.pagamentos_avulsos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric(10,2) not null,
  data_pagamento date not null,
  tipo text not null default 'receita'
    check (tipo in ('receita','taxa','outro')),
  forma_pagamento text check (forma_pagamento in ('boleto','pix','cartao','dinheiro','outro')),
  aluno_id uuid references public.alunos (id) on delete set null,
  observacoes text,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pagamentos_avulsos enable row level security;

create policy "Admins podem ver pagamentos avulsos"
  on public.pagamentos_avulsos for select using (public.is_admin());

create policy "Admins podem criar pagamentos avulsos"
  on public.pagamentos_avulsos for insert with check (public.is_admin());

create policy "Admins podem atualizar pagamentos avulsos"
  on public.pagamentos_avulsos for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir pagamentos avulsos"
  on public.pagamentos_avulsos for delete using (public.is_admin());

create trigger on_pagamentos_avulsos_updated
  before update on public.pagamentos_avulsos
  for each row execute function public.handle_updated_at();

grant select on public.pagamentos_avulsos to authenticated;
grant insert (descricao, valor, data_pagamento, tipo, forma_pagamento, aluno_id, observacoes)
  on public.pagamentos_avulsos to authenticated;
grant update (descricao, valor, data_pagamento, tipo, forma_pagamento, aluno_id, observacoes)
  on public.pagamentos_avulsos to authenticated;
grant delete on public.pagamentos_avulsos to authenticated;
grant select, insert, update, delete on public.pagamentos_avulsos to service_role;

-- ===== gastos =====

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null
    check (categoria in ('aluguel','material','salario','marketing','manutencao','outro')),
  valor numeric(10,2) not null,
  data_gasto date not null,
  forma_pagamento text,
  comprovante_url text,
  observacoes text,
  recorrente boolean not null default false,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gastos enable row level security;

create policy "Admins podem ver gastos"
  on public.gastos for select using (public.is_admin());

create policy "Admins podem criar gastos"
  on public.gastos for insert with check (public.is_admin());

create policy "Admins podem atualizar gastos"
  on public.gastos for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir gastos"
  on public.gastos for delete using (public.is_admin());

create trigger on_gastos_updated
  before update on public.gastos
  for each row execute function public.handle_updated_at();

grant select on public.gastos to authenticated;
grant insert (descricao, categoria, valor, data_gasto, forma_pagamento, comprovante_url, observacoes, recorrente)
  on public.gastos to authenticated;
grant update (descricao, categoria, valor, data_gasto, forma_pagamento, comprovante_url, observacoes, recorrente)
  on public.gastos to authenticated;
grant delete on public.gastos to authenticated;
grant select, insert, update, delete on public.gastos to service_role;

-- ===== log_webhooks_asaas =====

create table public.log_webhooks_asaas (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  asaas_event_id text unique not null,
  asaas_payment_id text,
  payload jsonb not null,
  processado boolean not null default false,
  erro text,
  created_at timestamptz not null default now()
);

create index log_webhooks_asaas_asaas_payment_id_idx on public.log_webhooks_asaas (asaas_payment_id);

alter table public.log_webhooks_asaas enable row level security;

create policy "Admins podem ver logs de webhook"
  on public.log_webhooks_asaas for select using (public.is_admin());

-- Sem policy de insert/update pra "authenticated": o endpoint de webhook
-- (src/app/api/webhooks/asaas/route.ts) grava com o client admin
-- (service_role), que bypassa RLS mas ainda precisa do grant abaixo.
grant select on public.log_webhooks_asaas to authenticated;
grant select, insert, update, delete on public.log_webhooks_asaas to service_role;
