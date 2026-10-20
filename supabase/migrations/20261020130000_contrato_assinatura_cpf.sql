-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Suporte à assinatura de contrato SEM login (validação por CPF, fluxo público em
-- /contrato/[matriculaId]/assinar) — registra quem de fato assinou (aluno ou responsável) e o
-- CPF digitado, para auditoria. service_role já tem grant irrestrito em contratos_assinados
-- (20260831100000_contrato_matricula.sql: "grant select, insert, update, delete ... to
-- service_role", sem lista de colunas), então as colunas novas não precisam de grant adicional
-- — e a policy de UPDATE restrita a aluno_id = auth.uid() não se aplica (service_role bypassa
-- RLS; o novo fluxo roda inteiramente via createAdminClient(), sem sessão).

alter table public.contratos_assinados
  add column if not exists cpf_assinante text,
  add column if not exists tipo_assinante text check (tipo_assinante in ('aluno', 'responsavel'));
