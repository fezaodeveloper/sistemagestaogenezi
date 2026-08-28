-- Módulo de Treinamentos: vídeos de onboarding da equipe, cadastrados pelo
-- admin, sem acesso de aluno.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.treinamentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  categoria text not null default 'geral'
    check (categoria in ('primeiros_passos','alunos','matriculas','financeiro','academico','relatorios','geral')),
  youtube_url text not null,
  status text not null default 'ativo'
    check (status in ('ativo','inativo')),
  ordem integer not null default 0,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.treinamentos enable row level security;

create policy "Admins podem ver treinamentos"
  on public.treinamentos for select using (public.is_admin());
create policy "Admins podem criar treinamentos"
  on public.treinamentos for insert with check (public.is_admin());
create policy "Admins podem atualizar treinamentos"
  on public.treinamentos for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir treinamentos"
  on public.treinamentos for delete using (public.is_admin());

create trigger on_treinamentos_updated
  before update on public.treinamentos
  for each row execute function public.handle_updated_at();

grant select on public.treinamentos to authenticated;
grant insert (titulo, descricao, categoria, youtube_url, status, ordem)
  on public.treinamentos to authenticated;
grant update (titulo, descricao, categoria, youtube_url, status, ordem)
  on public.treinamentos to authenticated;
grant delete on public.treinamentos to authenticated;
