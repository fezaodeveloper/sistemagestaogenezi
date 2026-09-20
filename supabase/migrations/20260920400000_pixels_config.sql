-- Pixels e rastreamento (Meta Ads, TikTok Ads, Google Ads, Google Analytics,
-- script personalizado) injetados nas páginas PÚBLICAS (campanha e agendamento) —
-- Configurações > Apps > Pixels e Rastreamento.
--
-- `script` é o código colado pelo admin (o "snippet" que a plataforma do pixel
-- fornece). É conteúdo de CONFIANÇA: só admin escreve (RLS abaixo) e o código roda no
-- navegador de quem abre a página pública.
--
-- cursos_ids: vazio = todas as páginas públicas; com ids, só páginas ligadas a um
-- desses cursos (a campanha tem curso_id; a página de agendamento não tem curso,
-- então só recebe pixels sem restrição). Sem FK (coluna array não tem): o app ignora
-- ids de cursos já excluídos.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.pixels_config (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null
    check (tipo in ('meta_ads', 'tiktok_ads', 'google_ads', 'google_analytics', 'script_personalizado')),
  script text not null,
  ativo boolean not null default true,
  cursos_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pixels_config_ativo_idx on public.pixels_config (ativo);

create trigger on_pixels_config_updated
  before update on public.pixels_config
  for each row execute function public.handle_updated_at();

-- ===== RLS: só admin =====

alter table public.pixels_config enable row level security;

create policy "Admins gerenciam pixels"
  on public.pixels_config for all
  using (public.is_admin())
  with check (public.is_admin());

-- ===== Grants =====

grant select, insert, update, delete on public.pixels_config to authenticated;
-- As páginas públicas (sem sessão) leem os pixels ativos com o client admin.
grant select, insert, update, delete on public.pixels_config to service_role;
