-- Módulo de Fornecedores + entregas de itens de estoque para alunos
-- (vincula estoque_movimentacoes a um aluno quando a saída é uma entrega).

-- ===== FORNECEDORES =====

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome_contato text not null,
  nome_empresa text not null,
  categoria text not null default 'outro'
    check (categoria in (
      'grafica','fardas','tecnologia','material_escritorio',
      'limpeza','manutencao','marketing','outro'
    )),
  telefone text,
  email text,
  whatsapp text,
  site text,
  cep text,
  endereco text,
  cidade text,
  estado text,
  observacoes text,
  ativo boolean not null default true,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fornecedores enable row level security;

create policy "Admins gerenciam fornecedores"
  on public.fornecedores for all using (public.is_admin());

grant select on public.fornecedores to authenticated;
grant insert (
  nome_contato, nome_empresa, categoria, telefone, email,
  whatsapp, site, cep, endereco, cidade, estado, observacoes, ativo
) on public.fornecedores to authenticated;
grant update (
  nome_contato, nome_empresa, categoria, telefone, email,
  whatsapp, site, cep, endereco, cidade, estado, observacoes, ativo
) on public.fornecedores to authenticated;
grant delete on public.fornecedores to authenticated;
grant select, insert, update, delete on public.fornecedores to service_role;

create trigger on_fornecedores_updated
  before update on public.fornecedores
  for each row execute function public.handle_updated_at();

-- ===== ENTREGAS DE ESTOQUE PARA ALUNOS =====
-- Vincula uma movimentação de saída ao aluno que recebeu o item.
-- aluno_nome_cache guarda o nome no momento da entrega — sobrevive à
-- exclusão do aluno (on delete set null em aluno_id) e evita precisar de
-- join com alunos/profiles só pra exibir o histórico de entregas.

alter table public.estoque_movimentacoes
  add column if not exists aluno_id uuid references public.alunos(id) on delete set null,
  add column if not exists aluno_nome_cache text;

grant insert (aluno_id, aluno_nome_cache) on public.estoque_movimentacoes to authenticated;
grant update (aluno_id, aluno_nome_cache) on public.estoque_movimentacoes to authenticated;

-- Tela de Entregas (TAREFA 2B) permite editar a observação e excluir um
-- registro de entrega — a migration original de estoque_movimentacoes
-- (20260914200000_estoque_manutencao_evasao.sql) só concedeu select+insert
-- pra authenticated, sem update/delete (não precisava até agora, já que a
-- tela de Estoque nunca editava/excluía uma movimentação já registrada).
grant update (motivo) on public.estoque_movimentacoes to authenticated;
grant delete on public.estoque_movimentacoes to authenticated;
