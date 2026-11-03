-- fix: grant para alunos.participa_conecta — erro "permission denied for table alunos (42501)"
-- ao cadastrar/editar aluno, depois de aplicar 20261028900000_aluno_participa_conecta.sql.
--
-- CAUSA RAIZ: aquela migration adicionou a coluna com um comentário incorreto ("authenticated
-- já tem grant total, sem lista de colunas, em alunos... colunas novas são cobertas
-- automaticamente, sem GRANT adicional") — FALSO. Confirmado em 20260801120000_create_alunos.sql:
-- alunos usa SELECT de tabela inteira, mas INSERT/UPDATE são sempre POR COLUNA pra
-- authenticated (replicado em toda coluna nova desde então: foto_url, senha_portal,
-- must_change_password, os campos expandidos em 20260907100000, etc. — ver também
-- 20260930100000_fix_alunos_update_grants.sql, um hardening quase idêntico a este). Só
-- participa_conecta ficou de fora do padrão, por isso createAluno/updateAluno (que usam o
-- client authenticated normal, não o admin/service_role) passaram a falhar com 42501 assim que
-- a coluna foi criada no banco.
--
-- createAluno/updateAluno (src/app/admin/alunos/actions.ts) já têm retry defensivo pra 42703/
-- PGRST204 (coluna ainda não existe) desde a tarefa anterior — mas 42501 é um erro DIFERENTE
-- (coluna existe, falta grant) que esse retry não cobre. O fix de verdade é este grant.

grant insert (participa_conecta) on public.alunos to authenticated;
grant update (participa_conecta) on public.alunos to authenticated;

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco. Pra desbloquear o cadastro
-- de aluno AGORA, sem esperar o próximo ciclo de revisão de migrations, rode só isto no SQL
-- Editor do Supabase (idempotente, seguro repetir):
--
--   grant insert (participa_conecta) on public.alunos to authenticated;
--   grant update (participa_conecta) on public.alunos to authenticated;
