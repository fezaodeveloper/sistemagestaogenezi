-- Taxa de matrícula opcional, cobrada no ato pelo wizard de matrícula
-- (Etapa 3 — Valores), separada das parcelas mensais.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS taxa_matricula numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS taxa_matricula_desconto_tipo text
    CHECK (taxa_matricula_desconto_tipo IN ('porcentagem','reais')),
  ADD COLUMN IF NOT EXISTS taxa_matricula_desconto_valor numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_matricula_final numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS taxa_matricula_forma_pagamento text
    CHECK (taxa_matricula_forma_pagamento IN ('dinheiro','pix','cartao','outro')),
  ADD COLUMN IF NOT EXISTS taxa_matricula_paga boolean NOT NULL DEFAULT false;

GRANT UPDATE (
  taxa_matricula, taxa_matricula_desconto_tipo, taxa_matricula_desconto_valor,
  taxa_matricula_final, taxa_matricula_forma_pagamento, taxa_matricula_paga
) ON public.matriculas TO authenticated;

-- Grant adicional (fora do texto original da tarefa): public.matriculas usa
-- grants coluna a coluna, não um blanket grant — todo campo novo inserido
-- por createMatricula() precisa de INSERT explícito além do UPDATE, mesmo
-- padrão já usado por taxa_cartao (20260908400000_matriculas_taxa_cartao.sql,
-- que também recebeu insert + update). Sem isso, createMatricula() quebra
-- com "permission denied for table matriculas" ao tentar gravar
-- taxa_matricula* já na criação da matrícula (TAREFA 2C).
GRANT INSERT (
  taxa_matricula, taxa_matricula_desconto_tipo, taxa_matricula_desconto_valor,
  taxa_matricula_final, taxa_matricula_forma_pagamento, taxa_matricula_paga
) ON public.matriculas TO authenticated;
