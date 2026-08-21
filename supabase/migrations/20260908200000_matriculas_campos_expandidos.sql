-- Migration aplicada manualmente em 21/08/2026
-- Adiciona campos expandidos em matriculas e vagas em turmas

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS vagas_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vagas_ocupadas integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.atualizar_vagas_turma()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.turmas
  SET vagas_ocupadas = (
    SELECT COUNT(*) FROM public.matriculas
    WHERE turma_id = COALESCE(NEW.turma_id, OLD.turma_id)
    AND status = 'ativa'
  )
  WHERE id = COALESCE(NEW.turma_id, OLD.turma_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_vagas_turma
AFTER INSERT OR UPDATE OR DELETE ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.atualizar_vagas_turma();

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS valor_original numeric(10,2),
  ADD COLUMN IF NOT EXISTS desconto_tipo text CHECK (
    desconto_tipo IN ('sem_bolsa','desconto_avista','indicacao','bolsa_social','outro')
  ),
  ADD COLUMN IF NOT EXISTS desconto_formato text CHECK (
    desconto_formato IN ('porcentagem','reais')
  ),
  ADD COLUMN IF NOT EXISTS desconto_valor numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final numeric(10,2),
  ADD COLUMN IF NOT EXISTS num_parcelas integer DEFAULT 1 CHECK (num_parcelas BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS valor_parcela numeric(10,2),
  ADD COLUMN IF NOT EXISTS forma_pagamento text CHECK (
    forma_pagamento IN ('boleto','pix','cartao','avista','outro')
  ),
  ADD COLUMN IF NOT EXISTS data_primeira_mensalidade date,
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS previsao_conclusao date,
  ADD COLUMN IF NOT EXISTS farda_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apostila_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kit_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_status text;

GRANT insert (
  valor_original, desconto_tipo, desconto_formato, desconto_valor,
  valor_final, num_parcelas, valor_parcela, forma_pagamento,
  data_primeira_mensalidade, data_inicio, previsao_conclusao,
  farda_entregue, apostila_entregue, kit_entregue, observacoes,
  asaas_customer_id, asaas_subscription_id, asaas_payment_status
) ON public.matriculas TO authenticated;

GRANT update (
  valor_original, desconto_tipo, desconto_formato, desconto_valor,
  valor_final, num_parcelas, valor_parcela, forma_pagamento,
  data_primeira_mensalidade, data_inicio, previsao_conclusao,
  farda_entregue, apostila_entregue, kit_entregue, observacoes,
  asaas_customer_id, asaas_subscription_id, asaas_payment_status,
  status
) ON public.matriculas TO authenticated;

GRANT insert (vagas_total, vagas_ocupadas) ON public.turmas TO authenticated;
GRANT update (vagas_total, vagas_ocupadas) ON public.turmas TO authenticated;

CREATE INDEX IF NOT EXISTS matriculas_status_idx ON public.matriculas (status);
CREATE INDEX IF NOT EXISTS matriculas_aluno_id_idx ON public.matriculas (aluno_id);

-- Nota: este arquivo documenta o SQL já aplicado manualmente.
-- Usar ADD COLUMN IF NOT EXISTS para ser idempotente caso
-- alguém rode supabase db push no futuro.
