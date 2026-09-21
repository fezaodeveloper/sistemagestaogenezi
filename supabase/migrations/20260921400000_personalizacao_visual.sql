-- Personalização visual centralizada (Configurações > Personalização): identidade, logos,
-- favicon e PWA. Tudo na linha única de `configuracoes`.
--
-- ===== O QUE JÁ EXISTIA (verificado antes de escrever) =====
--  * escola_nome        — 20260912200000 (default 'GÊNEZI Educação Profissional'). NÃO recriada.
--  * escola_logo_url / escola_logo_path — 20260916100000 (bucket público `escola-logo`, com
--    policies de insert/update/delete do admin; a de SELECT veio em 20260916300000). NÃO recriadas.
--  * portal_login_imagem_fundo_url / portal_login_cor_primaria — 20260920900000. NÃO recriadas.
--  * escola_cor_primaria — NÃO existia em nenhuma migration (o pedido a dava como existente).
--    Criada aqui (com `if not exists`, então é inofensiva se já houver a coluna no banco).
--  * Ícones PWA: hoje são arquivos fixos em public/icons/ e public/manifest.json (estático).
--
-- Todas as colunas novas são opcionais (nulas = comportamento atual do sistema), então aplicar
-- esta migration não muda nada visível até o admin preencher algo.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  -- Cor primária da escola (#rrggbb). Alimenta a cor do PWA (quando escola_cor_pwa está vazia) e
  -- o botão "Copiar para tela de login".
  add column if not exists escola_cor_primaria text
    check (escola_cor_primaria is null or escola_cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  -- Cor do PWA (theme_color/background_color do manifest). Vazia = usa escola_cor_primaria.
  add column if not exists escola_cor_pwa text
    check (escola_cor_pwa is null or escola_cor_pwa ~ '^#[0-9a-fA-F]{6}$'),
  -- Logo para tema escuro (o painel admin e o portal do aluno são sempre escuros).
  add column if not exists escola_logo_escuro_url text,
  -- Logo pequena (sidebar recolhida), tema claro e escuro.
  add column if not exists escola_logo_colapsada_url text,
  add column if not exists escola_logo_colapsada_escuro_url text,
  -- Favicon da aba do navegador (substitui o padrão).
  add column if not exists escola_favicon_url text,
  -- Ícones do PWA/manifest (PNG 192x192 e 512x512).
  add column if not exists pwa_icone_192_url text,
  add column if not exists pwa_icone_512_url text;

-- O admin salva pela sessão dele (a policy "Admins podem atualizar configuracoes" já restringe a
-- linha; o grant abre as colunas novas). updated_by já tem update desde a migration original.
grant update (
  escola_cor_primaria,
  escola_cor_pwa,
  escola_logo_escuro_url,
  escola_logo_colapsada_url,
  escola_logo_colapsada_escuro_url,
  escola_favicon_url,
  pwa_icone_192_url,
  pwa_icone_512_url
) on public.configuracoes to authenticated;

-- Páginas SEM sessão (manifest, favicon, theme-color no <head>) leem estas colunas como `anon`.
-- Além das 4 pedidas, entram escola_cor_primaria (fallback da cor do PWA) e escola_nome (nome do
-- app no manifest — o grant é idempotente e já existe em 20260920900000). Tudo dado público: cores,
-- nome da escola e URLs de imagens em bucket público.
grant select (
  escola_favicon_url,
  escola_cor_pwa,
  pwa_icone_192_url,
  pwa_icone_512_url,
  escola_cor_primaria,
  escola_nome
) on public.configuracoes to anon;

-- As logos/favicon/ícones novos usam o bucket `escola-logo` com upsert (nome fixo por arquivo).
-- O upsert do Storage precisa de policy de SELECT: ela veio em 20260916300000; se por acaso
-- ainda não foi aplicada no banco, cria aqui (sem falhar se já existir).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins veem logo da escola'
  ) then
    create policy "Admins veem logo da escola"
      on storage.objects for select
      using (bucket_id = 'escola-logo' and public.is_admin());
  end if;
end;
$$;
