-- Separa os banners do carrossel por tela de destino: /login (admin) e
-- /entrar (aluno) — cada uma passa a ter seu próprio conjunto configurável.
alter table public.login_banners
  add column if not exists tipo text not null default 'admin'
    check (tipo in ('admin', 'aluno'));

create index login_banners_tipo_idx on public.login_banners(tipo);
