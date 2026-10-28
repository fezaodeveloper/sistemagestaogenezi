-- Proteção de idade para candidatura no Gênezi Conecta (candidatos externos e alunos).
-- data_nascimento: só candidatos EXTERNOS preenchem (alunos já têm a própria em
-- public.alunos.data_nascimento — perfis_conecta não duplica esse valor pra aluno).
-- menor_com_termo: true quando o candidato (externo ou aluno) tem 16 ou 17 anos e
-- confirmou o checkbox de acompanhamento por responsável legal nas entrevistas.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.perfis_conecta
  add column if not exists data_nascimento date,
  add column if not exists menor_com_termo boolean not null default false;

-- authenticated já tem grant total (sem lista de colunas) em perfis_conecta desde
-- 20260916800000_genezi_conecta.sql — colunas novas são cobertas automaticamente, sem GRANT
-- adicional. service_role idem (bypass administrativo de sempre).
