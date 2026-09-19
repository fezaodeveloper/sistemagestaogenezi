-- Página pública de agendamento: campo opcional "Mensagem ou observação" — um
-- recado que o visitante deixa junto com o agendamento.
--
-- Nullable e com teto de 500 caracteres (o mesmo limite validado no formulário
-- e no Zod). Sem grant novo: o insert é feito pela Server Action pública com o
-- client admin (service_role, grant de tabela inteira) e o select do admin usa
-- o grant de tabela de `authenticated` — ambos já cobrem colunas novas.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.agendamentos
  add column if not exists mensagem text
    check (mensagem is null or char_length(mensagem) <= 500);
