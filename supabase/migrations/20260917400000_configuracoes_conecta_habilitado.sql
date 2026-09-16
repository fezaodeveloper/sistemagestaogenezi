-- Botão global para desabilitar o Gênezi Conecta (roadmap Grupo A, item 6).
-- Quando false: a aba "Gênezi Conecta" some do menu do aluno,
-- /aluno/conecta retorna 404, e /conecta/* e /empresa/* (proxy.ts)
-- redirecionam para /entrar.
--
-- Timestamp ajustado: a TAREFA não pediu um valor específico pra esta
-- migration. Renomeada mais abaixo em 20260917500000_campanhas_marketing.sql
-- (que a própria TAREFA pedia em 20260917400000) porque as duas migrations
-- vieram na mesma mensagem e não podem ocupar o mesmo timestamp.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.configuracoes
  add column if not exists conecta_habilitado boolean not null default true;

-- SELECT já é liberado pra authenticated na tabela toda (sem lista de
-- colunas) desde 20260821100000_create_pontos_gamificacao.sql — só falta o
-- GRANT de UPDATE pra essa coluna nova. service_role já tem grant total
-- (select/insert/update/delete) desde 20260831100000_contrato_matricula.sql
-- — é ele quem o proxy usa (client admin) pra checar essa coluna sem
-- depender de sessão, nas rotas públicas /conecta/* e /empresa/login.
grant update (conecta_habilitado) on public.configuracoes to authenticated;
