-- Prazo de entrega para entregas físicas de prêmios resgatados via créditos
-- (Melhoria 1 do painel de resgates). Complementa prazo_entrega_dias/
-- prazo_entrega_ate já existentes em medalha_recompensas/
-- medalha_recompensas_resgatadas (migration
-- 20260908110000_medalha_recompensas_prazo_entrega.sql), que cobrem só o
-- fluxo de recompensa concedida por medalha — este aqui é o fluxo normal de
-- resgate por créditos (resgatar_premio_fisico / processarEntregaPremio em
-- src/app/aluno/creditos/actions.ts).
--
-- Nenhum grant adicional necessário: os grants de entregas_premios
-- (migration 20260904100000_premios_entrega.sql) já são a nível de tabela,
-- sem restrição de coluna, então cobrem a coluna nova automaticamente.

alter table public.entregas_premios
  add column if not exists prazo_entrega_ate date;
