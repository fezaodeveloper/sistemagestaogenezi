-- Diferencia admin de aluno. Default 'aluno': ninguém se autopromove via
-- signup/trigger — o primeiro admin é promovido manualmente por SQL.
create type public.app_role as enum ('admin', 'aluno');

alter table public.profiles
  add column role public.app_role not null default 'aluno';

-- security definer pra evitar recursão infinita: uma policy em profiles que
-- consultasse profiles diretamente entraria em loop na hora de avaliar a
-- própria policy.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Além da policy de select já existente (usuário vê o próprio perfil), essa
-- amplia a visibilidade para admins verem todos os perfis. Policies do mesmo
-- comando (select) se combinam com OR — nenhuma das duas restringe a outra.
create policy "Admins podem ver todos os perfis"
  on public.profiles for select
  using (public.is_admin());

-- Sem grant novo em profiles: o "grant select on public.profiles to
-- authenticated" da primeira migration já cobre — quem decide as linhas
-- visíveis é a RLS, não o grant. A coluna role também não entra no grant de
-- update existente (update (full_name, avatar_url)), então ninguém muda o
-- próprio role via API.

-- Grant explícito de execução: mesma lógica da Fase 1 (não confiar em
-- comportamento implícito do Postgres para privilégios).
grant execute on function public.is_admin() to authenticated;
