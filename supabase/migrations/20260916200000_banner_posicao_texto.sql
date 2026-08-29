-- Posição vertical do texto (título/subtítulo) dentro do banner do login.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.login_banners
  add column if not exists texto_posicao text not null default 'centro'
    check (texto_posicao in ('topo', 'centro', 'base'));

grant update (texto_posicao) on public.login_banners to authenticated;
