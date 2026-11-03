-- Gênezi Conecta — opção "Participar do Gênezi Conecta" na matrícula/cadastro do aluno, e
-- termo de participação que o próprio aluno aceita no portal (/aluno/conecta) antes de poder
-- ativar a visibilidade do perfil.
--
-- CORREÇÃO (ver 20261103100000_fix_grant_participa_conecta.sql): o comentário original aqui
-- dizia que authenticated já tinha grant total (sem lista de colunas) em alunos — FALSO.
-- alunos usa SELECT de tabela inteira, mas INSERT/UPDATE são sempre POR COLUNA (confirmado em
-- 20260801120000_create_alunos.sql) — essa premissa errada deixou alunos.participa_conecta sem
-- grant de insert/update, causando "permission denied for table alunos (42501)" ao cadastrar/
-- editar aluno depois que esta migration foi aplicada. perfis_conecta (tabela nova, não coluna
-- nova numa tabela existente) está correto: 20260916800000_genezi_conecta.sql de fato concede
-- grant amplo pra ela.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.alunos
  add column if not exists participa_conecta boolean not null default false;

alter table public.perfis_conecta
  add column if not exists termo_conecta_aceito boolean not null default false,
  add column if not exists termo_conecta_data timestamptz;
