-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- Senha do Portal do Responsável (CPF + senha, em vez de só CPF). Hash gerado em Node (scrypt,
-- ver src/lib/responsavel/senha.ts) — sem dependência nova (bcrypt não está no package.json).
-- Nunca guarda a senha em texto puro: só o hash (formato "salt:chave", ambos hex).

alter table public.responsaveis
  add column if not exists senha_hash text;

-- Busca de login por CPF (validarCpfResponsavelGlobal já faz esse scan hoje, sem índice —
-- tabela pequena até aqui, mas o índice não tem custo e evita virar table scan conforme a base
-- de responsáveis cresce).
create index if not exists idx_responsaveis_cpf on public.responsaveis (cpf);

-- senha_hash é escrito pelo admin (tela de edição do aluno, client autenticado) — mesmo padrão
-- de grant por coluna já usado nos demais campos de responsaveis (20260801120000/20260907100000).
-- service_role já tem select/insert/update/delete amplos na tabela (20260831100000), sem grant
-- adicional necessário pra leitura no login público do portal.
grant insert (senha_hash) on public.responsaveis to authenticated;
grant update (senha_hash) on public.responsaveis to authenticated;
