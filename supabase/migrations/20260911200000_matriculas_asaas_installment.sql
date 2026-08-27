-- Parcelamento no Asaas (POST /payments com installmentCount) substitui a
-- criação de cobranças individuais por parcela quando a matrícula tem mais
-- de 1 parcela — asaas_installment_id identifica o parcelamento inteiro no
-- Asaas, usado pra buscar as parcelas geradas (buscarParcelasDoParcelamento)
-- e pra gerar o carnê oficial (gerarCarneAsaas). SELECT já é liberado pra
-- authenticated em toda a tabela desde 20260801130000_create_matriculas.sql
-- (sem lista de colunas), então só falta o GRANT de update pra essa coluna.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.matriculas
  add column if not exists asaas_installment_id text;

grant update (asaas_installment_id) on public.matriculas to authenticated;
