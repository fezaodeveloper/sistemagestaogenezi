create type public.material_tipo as enum ('pdf', 'video_youtube', 'slide', 'link');

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.aulas (id) on delete cascade,
  tipo public.material_tipo not null,
  titulo text not null,
  url text not null,
  ordem integer not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materiais_ordem_check check (ordem > 0),
  -- PDF fica em um bucket privado do Storage (caminho relativo, sem host);
  -- os demais tipos apontam para uma URL externa de verdade.
  constraint materiais_url_formato_check check (
    (tipo = 'pdf' and url !~ '^https?://')
    or (tipo <> 'pdf' and url ~ '^https?://')
  )
);

-- Postgres não indexa FK automaticamente — sem isso, toda listagem por aula
-- faria table scan.
create index materiais_aula_id_idx on public.materiais (aula_id);

alter table public.materiais enable row level security;

create policy "Admins podem ver materiais"
  on public.materiais for select using (public.is_admin());
create policy "Admins podem criar materiais"
  on public.materiais for insert with check (public.is_admin());
create policy "Admins podem atualizar materiais"
  on public.materiais for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir materiais"
  on public.materiais for delete using (public.is_admin());

create trigger on_materiais_updated
  before update on public.materiais
  for each row execute function public.handle_updated_at();

grant select on public.materiais to authenticated;
grant insert (aula_id, tipo, titulo, url, ordem) on public.materiais to authenticated;
grant update (tipo, titulo, url, ordem) on public.materiais to authenticated;
grant delete on public.materiais to authenticated;

-- Storage: bucket privado para os PDFs (sem download público direto — o
-- visualizador interno, numa fase futura, vai gerar signed URLs de curta
-- duração sob demanda em vez de expor um link público permanente).
insert into storage.buckets (id, name, public) values ('materiais', 'materiais', false);

create policy "Admins podem ver arquivos de materiais"
  on storage.objects for select
  using (bucket_id = 'materiais' and public.is_admin());
create policy "Admins podem enviar arquivos de materiais"
  on storage.objects for insert
  with check (bucket_id = 'materiais' and public.is_admin());
create policy "Admins podem atualizar arquivos de materiais"
  on storage.objects for update
  using (bucket_id = 'materiais' and public.is_admin());
create policy "Admins podem excluir arquivos de materiais"
  on storage.objects for delete
  using (bucket_id = 'materiais' and public.is_admin());
