-- Estoque de materiais, chamados de manutenção interna e índice de risco de
-- evasão (cache calculado diariamente pelo cron calcular-evasao).

-- ===== ESTOQUE =====

create table public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'outro'
    check (categoria in ('apostila','farda','kit','material','outro')),
  quantidade_atual integer not null default 0,
  quantidade_minima integer not null default 5,
  unidade text not null default 'unidade',
  observacoes text,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.estoque_itens(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade integer not null,
  motivo text,
  referencia_id uuid,  -- matricula_id quando for saída para aluno
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ===== MANUTENÇÃO =====

create table public.manutencao_chamados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  local text,
  prioridade text not null default 'media'
    check (prioridade in ('baixa','media','alta','urgente')),
  status text not null default 'aberto'
    check (status in ('aberto','em_andamento','resolvido','cancelado')),
  resolvido_em timestamptz,
  observacoes_resolucao text,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== ÍNDICE DE EVASÃO (cache calculado diariamente) =====

create table public.indices_evasao (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  matricula_id uuid references public.matriculas(id) on delete set null,
  indice integer not null default 0 check (indice between 0 and 100),
  componente_faltas integer not null default 0,
  componente_financeiro integer not null default 0,
  componente_inatividade integer not null default 0,
  componente_notas integer not null default 0,
  motivos jsonb not null default '[]',
  alerta_enviado boolean not null default false,
  calculado_em timestamptz not null default now(),
  unique (aluno_id, matricula_id)
);

create index indices_evasao_aluno_id_idx on public.indices_evasao(aluno_id);
create index indices_evasao_indice_idx on public.indices_evasao(indice);

-- ===== RLS =====

alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentacoes enable row level security;
alter table public.manutencao_chamados enable row level security;
alter table public.indices_evasao enable row level security;

create policy "Admins gerenciam estoque"
  on public.estoque_itens for all using (public.is_admin());
create policy "Admins gerenciam movimentações"
  on public.estoque_movimentacoes for all using (public.is_admin());
create policy "Admins gerenciam chamados"
  on public.manutencao_chamados for all using (public.is_admin());
create policy "Admins veem índices de evasão"
  on public.indices_evasao for select using (public.is_admin());

-- ===== Triggers updated_at =====

create trigger on_estoque_itens_updated
  before update on public.estoque_itens
  for each row execute function public.handle_updated_at();
create trigger on_manutencao_chamados_updated
  before update on public.manutencao_chamados
  for each row execute function public.handle_updated_at();

-- ===== Grants =====

grant select on public.estoque_itens to authenticated;
grant insert, update, delete on public.estoque_itens to authenticated;
grant select on public.estoque_movimentacoes to authenticated;
grant insert on public.estoque_movimentacoes to authenticated;
grant select on public.manutencao_chamados to authenticated;
grant insert, update, delete on public.manutencao_chamados to authenticated;
grant select on public.indices_evasao to authenticated;
grant select, insert, update, delete on public.indices_evasao to service_role;
grant select, insert on public.estoque_movimentacoes to service_role;

-- O cron calcular-evasao (src/app/api/cron/calcular-evasao/route.ts) roda
-- com supabaseAdmin e precisa ler alunos/matriculas/parcelas/presencas/
-- certificados/eventos_automacao pra calcular o índice — todas essas
-- tabelas já têm grant pra service_role de migrations anteriores, exceto
-- indices_evasao (concedido acima). O relatório semanal (TAREFA 7) também
-- passa a ler estoque_itens e manutencao_chamados via supabaseAdmin, então
-- essas duas precisam do grant de leitura pra service_role também.
grant select on public.estoque_itens to service_role;
grant select on public.manutencao_chamados to service_role;
