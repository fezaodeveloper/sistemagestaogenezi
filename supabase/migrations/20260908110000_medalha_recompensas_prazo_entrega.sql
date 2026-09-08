-- Prazo de entrega para recompensas de medalha do tipo prêmio físico/híbrido.
-- prazo_entrega_dias fica em medalha_recompensas (configurado pelo admin ao
-- vincular a recompensa); prazo_entrega_ate fica em
-- medalha_recompensas_resgatadas (data calculada no momento da concessão ao
-- aluno, hoje + prazo_entrega_dias). Nenhuma das duas tabelas restringe
-- grants por coluna (grant de insert/update já é a nível de tabela desde a
-- migration original), então as colunas novas já ficam utilizáveis sem
-- grants adicionais.

alter table public.medalha_recompensas
  add column if not exists prazo_entrega_dias integer check (prazo_entrega_dias is null or prazo_entrega_dias > 0);

alter table public.medalha_recompensas_resgatadas
  add column if not exists prazo_entrega_ate date;
