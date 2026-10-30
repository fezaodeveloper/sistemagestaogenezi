-- Gênezi Conecta — status "contratado" em candidaturas_conecta (TAREFA: empresa marca
-- candidato como contratado; aluno vê "Contratado!" no próprio portal).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.candidaturas_conecta
  drop constraint if exists candidaturas_conecta_status_check;

alter table public.candidaturas_conecta
  add constraint candidaturas_conecta_status_check
  check (status in ('pendente', 'visualizado', 'contato', 'rejeitado', 'contratado'));
