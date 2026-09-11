-- Gênezi Conecta — Etapa 1: base de dados + autenticação de empresas.
-- NÃO altera nada do sistema atual — role 'empresa' é isolada de
-- admin/aluno (nenhuma policy ou grant existente é tocada).
--
-- Nome do arquivo ajustado de 20260912100000 (pedido original) para
-- 20260916800000: 20260912100000_certificado_template_cor_texto.sql já
-- existe.
--
-- role é enum (public.app_role), não texto com CHECK (ver
-- 20260731180000_add_role_to_profiles.sql) — por isso "adicionar ao enum"
-- em vez de alterar um CHECK. add value if not exists é seguro dentro da
-- própria transação da migration porque nenhuma instrução abaixo usa o
-- literal 'empresa' num comparador (mesmo padrão já usado em
-- 20260908100000_medalha_recompensas.sql pra pontos_tipo_evento).
--
-- Mostrar SQL — NÃO aplicar.

alter type public.app_role add value if not exists 'empresa';

-- ===== Tabela de empresas =====

create table public.empresas_conecta (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nome_empresa text not null,
  cnpj text,
  nome_responsavel text not null,
  email text not null,
  whatsapp text,
  telefone text,
  site text,
  setor text,
  cidade text,
  estado text,
  logo_url text,
  logo_path text,
  descricao text,
  status text not null default 'pendente'
    check (status in ('pendente','ativa','suspensa','cancelada')),
  aprovada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresas_conecta enable row level security;

create policy "Empresa ve proprio perfil"
  on public.empresas_conecta for select
  using (profile_id = auth.uid());

create policy "Empresa edita proprio perfil"
  on public.empresas_conecta for update
  using (profile_id = auth.uid());

create policy "Admins gerenciam empresas"
  on public.empresas_conecta for all using (public.is_admin());

create policy "Empresa se cadastra"
  on public.empresas_conecta for insert
  with check (profile_id = auth.uid());

grant select, insert, update on public.empresas_conecta to authenticated;
grant select, insert, update, delete on public.empresas_conecta to service_role;

create trigger on_empresas_conecta_updated
  before update on public.empresas_conecta
  for each row execute function public.handle_updated_at();

-- ===== Tabela de vagas =====

create table public.vagas_conecta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas_conecta(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  requisitos text,
  cidade text not null,
  estado text not null,
  modalidade text not null default 'presencial'
    check (modalidade in ('presencial','hibrido','remoto')),
  tipo text not null default 'emprego'
    check (tipo in ('emprego','estagio')),
  salario_min numeric,
  salario_max numeric,
  salario_oculto boolean not null default false,
  carga_horaria text,
  prazo_candidatura date,
  status text not null default 'ativa'
    check (status in ('ativa','pausada','encerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vagas_conecta enable row level security;

create policy "Empresa gerencia proprias vagas"
  on public.vagas_conecta for all
  using (empresa_id in (
    select id from public.empresas_conecta where profile_id = auth.uid()
  ));

create policy "Todos podem ver vagas ativas"
  on public.vagas_conecta for select
  using (status = 'ativa');

create policy "Admins gerenciam vagas"
  on public.vagas_conecta for all using (public.is_admin());

grant select on public.vagas_conecta to authenticated;
grant insert, update, delete on public.vagas_conecta to authenticated;
grant select, insert, update, delete on public.vagas_conecta to service_role;

create trigger on_vagas_conecta_updated
  before update on public.vagas_conecta
  for each row execute function public.handle_updated_at();

-- ===== Tabela de perfis de candidatos =====

create table public.perfis_conecta (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete cascade,
  -- Para candidatos externos (não alunos):
  nome text,
  email text,
  whatsapp text,
  cidade text,
  estado text,
  -- Campos comuns:
  resumo text,
  experiencias text,
  linkedin_url text,
  curriculo_url text,
  curriculo_path text,
  disponibilidade text default 'imediato'
    check (disponibilidade in ('imediato','15_dias','30_dias','a_combinar')),
  modalidade_preferida text default 'presencial'
    check (modalidade_preferida in ('presencial','hibrido','remoto','qualquer')),
  visivel boolean not null default false,
  tipo text not null default 'aluno'
    check (tipo in ('aluno','externo')),
  -- Para externos pagos:
  esta_ativo boolean not null default false,
  plano text check (plano in ('basico','pro','premium')),
  asaas_subscription_id text,
  assinatura_inicio timestamptz,
  assinatura_fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aluno_id)
);

alter table public.perfis_conecta enable row level security;

create policy "Aluno gerencia proprio perfil"
  on public.perfis_conecta for all
  using (aluno_id = auth.uid());

create policy "Empresas veem perfis visiveis e ativos"
  on public.perfis_conecta for select
  using (
    visivel = true and (
      tipo = 'aluno' or (tipo = 'externo' and esta_ativo = true)
    )
  );

create policy "Admins gerenciam perfis"
  on public.perfis_conecta for all using (public.is_admin());

grant select on public.perfis_conecta to authenticated;
grant insert, update on public.perfis_conecta to authenticated;
grant select, insert, update, delete on public.perfis_conecta to service_role;

create trigger on_perfis_conecta_updated
  before update on public.perfis_conecta
  for each row execute function public.handle_updated_at();

-- ===== Notificações do admin para empresas =====

create table public.notificacoes_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas_conecta(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  lida boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.notificacoes_empresa enable row level security;

create policy "Empresa ve proprias notificacoes"
  on public.notificacoes_empresa for select
  using (empresa_id in (
    select id from public.empresas_conecta where profile_id = auth.uid()
  ));

create policy "Empresa marca como lida"
  on public.notificacoes_empresa for update
  using (empresa_id in (
    select id from public.empresas_conecta where profile_id = auth.uid()
  ));

create policy "Admins gerenciam notificacoes"
  on public.notificacoes_empresa for all using (public.is_admin());

-- INSERT pra authenticated adicionado além do pedido original: a policy
-- "Admins gerenciam notificacoes" (FOR ALL) libera o INSERT via RLS, mas
-- sem o GRANT o Postgres bloqueia antes mesmo de avaliar a policy — a ação
-- "Enviar notificação" do admin roda pelo client autenticado normal (não
-- pelo client admin/service_role), mesmo padrão de todo o resto do CRUD
-- admin neste projeto.
grant select, insert, update on public.notificacoes_empresa to authenticated;
grant select, insert, update, delete on public.notificacoes_empresa to service_role;
