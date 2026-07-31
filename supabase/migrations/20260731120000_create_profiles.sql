-- Tabela de perfis, 1:1 com auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Usuários podem ver o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuários podem atualizar o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Cria automaticamente uma linha em profiles quando um novo usuário se cadastra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém updated_at em dia a cada alteração do perfil.
create function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Grants explícitos: sem insert (perfil só é criado via trigger security definer)
-- e sem delete (perfil é removido via cascade quando o usuário é apagado).
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
