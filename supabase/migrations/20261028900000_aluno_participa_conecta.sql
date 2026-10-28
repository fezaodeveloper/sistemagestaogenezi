-- Gênezi Conecta — opção "Participar do Gênezi Conecta" na matrícula/cadastro do aluno, e
-- termo de participação que o próprio aluno aceita no portal (/aluno/conecta) antes de poder
-- ativar a visibilidade do perfil.
--
-- authenticated já tem grant total (sem lista de colunas) em alunos e perfis_conecta desde,
-- respectivamente, a criação de public.alunos e 20260916800000_genezi_conecta.sql — colunas
-- novas são cobertas automaticamente, sem GRANT adicional. service_role idem.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.alunos
  add column if not exists participa_conecta boolean not null default false;

alter table public.perfis_conecta
  add column if not exists termo_conecta_aceito boolean not null default false,
  add column if not exists termo_conecta_data timestamptz;
