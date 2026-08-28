-- Carrossel de banners da tela de login. Bucket de Storage criado aqui via
-- migration (não manualmente no painel Supabase) — mesmo padrão já usado
-- em "cursos" (ver 20260825100000_add_capa_cursos.sql) e "premios": bucket
-- público (a tela de login não tem sessão, precisa poder exibir a imagem
-- sem autenticação), com insert/update/delete restritos a admin via
-- policies em storage.objects.
insert into storage.buckets (id, name, public) values ('login-banners', 'login-banners', true);

create policy "Admins podem enviar banners de login"
  on storage.objects for insert
  with check (bucket_id = 'login-banners' and public.is_admin());
create policy "Admins podem atualizar banners de login"
  on storage.objects for update
  using (bucket_id = 'login-banners' and public.is_admin());
create policy "Admins podem excluir banners de login"
  on storage.objects for delete
  using (bucket_id = 'login-banners' and public.is_admin());

create table public.login_banners (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  subtitulo text,
  storage_path text not null,
  public_url text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.login_banners enable row level security;

-- Qualquer pessoa pode ver banners ativos (tela de login é pública).
create policy "Banners ativos são públicos"
  on public.login_banners for select
  using (ativo = true);

-- Só admin pode gerenciar (inclui ver os inativos, no painel).
create policy "Admins gerenciam banners"
  on public.login_banners for all using (public.is_admin());

grant select on public.login_banners to anon;
grant select on public.login_banners to authenticated;
grant insert, update, delete on public.login_banners to authenticated;

create trigger on_login_banners_updated
  before update on public.login_banners
  for each row execute function public.handle_updated_at();
