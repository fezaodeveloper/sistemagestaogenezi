-- Hardening defensivo: "editar aluno não salva" às vezes é 42501 (permission denied) numa
-- coluna sem grant de UPDATE pro role authenticated — RLS habilitada não basta, o Postgres
-- também checa GRANT de tabela/coluna antes de sequer avaliar a policy (ver CLAUDE.md).
--
-- O grant de bairro/endereco/numero/complemento/cep/cidade/estado (e os demais campos
-- expandidos) já existe desde 20260907100000_alunos_campos_expandidos.sql — este arquivo só
-- REAFIRMA o mesmo grant (idempotente: repetir um grant já concedido não dá erro) como
-- diagnóstico/fix caso aquela migration não tenha sido aplicada de fato no banco, ou caso o
-- grant tenha sido revogado manualmente em algum momento.
--
-- Pra confirmar o estado atual antes de aplicar, rodar no SQL Editor do Supabase:
--   select column_name from information_schema.role_column_grants
--   where table_name = 'alunos' and grantee = 'authenticated' and privilege_type = 'UPDATE'
--   order by column_name;
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

grant update (
  full_name, cpf, telefone, endereco, data_nascimento,
  cep, numero, complemento, bairro, cidade, estado,
  observacoes, status_aluno
) on public.alunos to authenticated;
