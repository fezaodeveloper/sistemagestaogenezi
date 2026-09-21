-- Personalização da tela de login do portal do aluno (/entrar) — Configurações >
-- Portal do Aluno > Login. Tudo em `configuracoes` (linha única), como as demais
-- configurações da escola.
--
-- portal_login_template: 'card' (formulário num cartão sobre fundo) ou 'split' (imagem
--   hero de um lado, formulário do outro).
-- portal_login_tipo_senha:
--   'padrao'   — e-mail + senha (comportamento de sempre). Se portal_login_senha_padrao
--                estiver preenchida, é a senha dada a TODO aluno novo no cadastro.
--   'aleatoria'— o sistema gera uma senha aleatória (8 caracteres) ao cadastrar o aluno
--                e a envia por e-mail (template "acesso").
--   'so_email' — o campo de senha some do login; o aluno recebe um link de acesso
--                (magic link) por e-mail.
--
-- SEGURANÇA de portal_login_senha_padrao: `authenticated` tem SELECT na tabela inteira
-- (todo aluno logado lê `configuracoes`), então o valor é gravado CRIPTOGRAFADO pelo app
-- (AES-256-GCM, prefixo "enc:v1:", GATEWAYS_ENCRYPTION_KEY) — nunca em texto puro. E
-- `anon` (a tela de login, sem sessão) NÃO recebe grant nessa coluna.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  add column if not exists portal_login_template text not null default 'card'
    check (portal_login_template in ('card', 'split')),
  add column if not exists portal_login_titulo text not null default 'Área do Aluno',
  add column if not exists portal_login_subtitulo text not null default 'Entre com seu e-mail e senha',
  add column if not exists portal_login_cor_primaria text not null default '#0ea5e9'
    check (portal_login_cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists portal_login_cor_fundo text not null default '#18181b'
    check (portal_login_cor_fundo ~ '^#[0-9a-fA-F]{6}$'),
  -- Imagem de fundo (template card) ou imagem hero (template split).
  add column if not exists portal_login_imagem_fundo_url text,
  add column if not exists portal_login_tipo_senha text not null default 'padrao'
    check (portal_login_tipo_senha in ('padrao', 'aleatoria', 'so_email')),
  add column if not exists portal_login_senha_padrao text,
  add column if not exists portal_login_mostrar_instalar_app boolean not null default true;

-- A tela de login não tem sessão: lê estas colunas como `anon`. (portal_login_senha_padrao
-- fica DE FORA, de propósito. escola_nome é dado público — aparece na tela hero.)
grant select (
  escola_nome,
  portal_login_template,
  portal_login_titulo,
  portal_login_subtitulo,
  portal_login_cor_primaria,
  portal_login_cor_fundo,
  portal_login_imagem_fundo_url,
  portal_login_tipo_senha,
  portal_login_mostrar_instalar_app
) on public.configuracoes to anon;

-- O admin salva pela sessão dele (a policy "Admins podem atualizar configuracoes" já
-- restringe a linha; o grant abaixo abre as colunas novas).
grant update (
  portal_login_template,
  portal_login_titulo,
  portal_login_subtitulo,
  portal_login_cor_primaria,
  portal_login_cor_fundo,
  portal_login_imagem_fundo_url,
  portal_login_tipo_senha,
  portal_login_senha_padrao,
  portal_login_mostrar_instalar_app
) on public.configuracoes to authenticated;
