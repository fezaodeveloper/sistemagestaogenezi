-- Gênezi Conecta — campo "Número" no endereço da empresa (TAREFA: remover código de acesso,
-- adicionar número, termos e notificações).
--
-- authenticated já tem grant total (sem lista de colunas) em empresas_conecta desde
-- 20260916800000_genezi_conecta.sql — coluna nova é coberta automaticamente, sem GRANT adicional.
-- service_role idem.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.empresas_conecta
  add column if not exists numero text;
