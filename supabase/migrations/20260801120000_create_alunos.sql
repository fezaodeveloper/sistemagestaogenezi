-- Policy nova em profiles (tabela da Fase 2) — falta pro admin editar dados
-- de outros usuários (ex: nome de um aluno).
create policy "Admins podem atualizar perfis"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Flag setada na criação da conta (senha temporária) e zerada futuramente
-- pelo próprio aluno, quando o fluxo de troca de senha for construído.
alter table public.profiles
  add column must_change_password boolean not null default false;

-- Atualiza o trigger da Fase 2 pra também gravar a flag, lida de
-- raw_user_meta_data no momento da criação — evita um UPDATE separado
-- logo após o insert feito pela Admin API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, must_change_password)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  return new;
end;
$$;

-- Aditivo ao grant de update já existente (full_name, avatar_url) da Fase 2
-- — não precisa reescrevê-lo.
grant update (must_change_password) on public.profiles to authenticated;

create table public.alunos (
  id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  cpf text not null unique,
  telefone text not null,
  endereco text,
  data_nascimento date not null,
  turma_id uuid references public.turmas (id) on delete restrict,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index alunos_turma_id_idx on public.alunos (turma_id);

create table public.responsaveis (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  nome text not null,
  cpf text not null,
  telefone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index responsaveis_aluno_id_idx on public.responsaveis (aluno_id);

alter table public.alunos enable row level security;
alter table public.responsaveis enable row level security;

create policy "Admins podem ver alunos"
  on public.alunos for select using (public.is_admin());
create policy "Admins podem criar alunos"
  on public.alunos for insert with check (public.is_admin());
create policy "Admins podem atualizar alunos"
  on public.alunos for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir alunos"
  on public.alunos for delete using (public.is_admin());

create policy "Admins podem ver responsaveis"
  on public.responsaveis for select using (public.is_admin());
create policy "Admins podem criar responsaveis"
  on public.responsaveis for insert with check (public.is_admin());
create policy "Admins podem atualizar responsaveis"
  on public.responsaveis for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir responsaveis"
  on public.responsaveis for delete using (public.is_admin());

create trigger on_alunos_updated
  before update on public.alunos
  for each row execute function public.handle_updated_at();
create trigger on_responsaveis_updated
  before update on public.responsaveis
  for each row execute function public.handle_updated_at();

-- alunos.id não tem default: é sempre o id do usuário recém-criado via
-- Admin API, nunca gerado à toa. email é insert-only — mudar e-mail exige
-- sincronizar com auth.users via Admin API, decisão separada pro futuro.
grant select on public.alunos to authenticated;
grant insert (id, email, cpf, telefone, endereco, data_nascimento, turma_id) on public.alunos to authenticated;
grant update (cpf, telefone, endereco, data_nascimento, turma_id) on public.alunos to authenticated;
grant delete on public.alunos to authenticated;

grant select on public.responsaveis to authenticated;
grant insert (aluno_id, nome, cpf, telefone) on public.responsaveis to authenticated;
grant update (nome, cpf, telefone) on public.responsaveis to authenticated;
grant delete on public.responsaveis to authenticated;
