-- Gênezi Conecta — assinatura anual da empresa (TAREFA: empresa deixa de ser gratuita, passa a
-- pagar R$ 29,90/ano via Asaas, mesmo modelo de assinatura recorrente já usado por candidatos
-- externos em perfis_conecta.asaas_subscription_id).
--
-- Risco conhecido, não urgente: authenticated já tem UPDATE sem lista de colunas em
-- empresas_conecta desde a criação da tabela (20260916800000_genezi_conecta.sql) — essas 4
-- colunas novas herdam esse mesmo grant amplo, então uma empresa autenticada tecnicamente
-- consegue chamar um update cru setando assinatura_status='ativa' sem pagar, contornando a UI
-- (mesma limitação, hoje, de "status"/"aprovada_em" nessa tabela, usados pela aprovação do
-- admin). Corrigir com REVOKE+GRANT por coluna (como já feito em candidaturas_conecta) exigiria
-- também migrar ativarEmpresa/suspenderEmpresa (admin/conecta/actions.ts) pro client admin —
-- hoje usam o client autenticado comum — fora do escopo desta tarefa, não arriscar numa
-- migration isolada sem testar o resto do fluxo de aprovação.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.empresas_conecta
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists assinatura_status text not null default 'pendente'
    check (assinatura_status in ('pendente', 'ativa', 'inativa', 'cancelada')),
  add column if not exists assinatura_vencimento timestamptz;

-- Empresas já aprovadas no modelo antigo (gratuito, status='ativa') são migradas direto pra
-- assinatura_status='ativa' — a cobrança nova vale só pra quem se cadastrar a partir de agora,
-- sem bloqueio retroativo de quem já usa a plataforma (decisão confirmada com o responsável pelo
-- projeto antes de aplicar). Empresas pendentes/suspensas/canceladas ficam com o default
-- 'pendente' — nunca tiveram acesso completo mesmo no modelo antigo.
update public.empresas_conecta
  set assinatura_status = 'ativa'
  where status = 'ativa';
