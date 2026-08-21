-- Adiciona 'inativa' ao enum matricula_status
-- e mantém 'transferida' para compatibilidade com dados existentes
ALTER TYPE matricula_status ADD VALUE IF NOT EXISTS 'inativa';

-- Nota: 'transferida' permanece no enum para não quebrar
-- dados históricos que possam existir com esse valor.
-- No código, tratamos 'transferida' como alias de 'inativa'.
