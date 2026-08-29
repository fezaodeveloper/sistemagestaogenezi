-- Tamanho e cor de texto configuráveis por banner do login, rodapé
-- configurável das telas de login e logomarca da escola (usada no lugar
-- do emoji placeholder em /login e /entrar).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== Banners do login: tamanho e cor do título/subtítulo =====

alter table public.login_banners
  add column if not exists titulo_tamanho text not null default 'medio'
    check (titulo_tamanho in ('pequeno', 'medio', 'grande')),
  add column if not exists subtitulo_tamanho text not null default 'medio'
    check (subtitulo_tamanho in ('pequeno', 'medio', 'grande')),
  add column if not exists titulo_cor text not null default '#FFFFFF',
  add column if not exists subtitulo_cor text not null default '#FFFFFF';

grant update (titulo_tamanho, subtitulo_tamanho, titulo_cor, subtitulo_cor)
  on public.login_banners to authenticated;

-- ===== Configurações: rodapé da tela de login e logomarca da escola =====

alter table public.configuracoes
  add column if not exists login_rodape text default '© 2026 GÊNEZI Educação Profissional',
  add column if not exists escola_logo_url text,
  add column if not exists escola_logo_path text;

-- SELECT já é liberado pra authenticated na tabela toda (sem lista de
-- colunas) desde 20260821100000_create_pontos_gamificacao.sql — só falta o
-- GRANT de UPDATE pras colunas novas. As telas de login (/login, /entrar)
-- rodam sem sessão (role anon), por isso o SELECT dessas duas colunas
-- específicas também precisa de grant pra anon — a policy de select já é
-- `using (true)` desde a criação da tabela, só faltava o grant.
grant update (login_rodape, escola_logo_url, escola_logo_path)
  on public.configuracoes to authenticated;
grant select (escola_logo_url, login_rodape) on public.configuracoes to anon;

-- ===== Bucket da logomarca da escola =====
-- Mesmo padrão já usado em "login-banners", "cursos" e "premios": bucket
-- público (a tela de login não tem sessão, precisa exibir a imagem sem
-- autenticação), com insert/update/delete restritos a admin via policies
-- em storage.objects.

insert into storage.buckets (id, name, public) values ('escola-logo', 'escola-logo', true);

create policy "Admins enviam logo da escola"
  on storage.objects for insert
  with check (bucket_id = 'escola-logo' and public.is_admin());
create policy "Admins atualizam logo da escola"
  on storage.objects for update
  using (bucket_id = 'escola-logo' and public.is_admin());
create policy "Admins excluem logo da escola"
  on storage.objects for delete
  using (bucket_id = 'escola-logo' and public.is_admin());
