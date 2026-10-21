-- NÃO APLICADA — aplicar manualmente no SQL Editor do Supabase

-- Portal do Responsável (/responsavel/[alunoId]) — acesso sem login, autenticado por CPF
-- (mesmo padrão dos itens 6/7: contrato e termo de imagem por CPF). Nenhum ALTER TABLE
-- necessário: alunoId como token implícito já usa a coluna alunos.id existente; a validação de
-- CPF lê responsaveis.cpf (já existente), sempre via createAdminClient() (service_role bypassa
-- RLS e já tem grant irrestrito em responsaveis — ver 20260801120000_create_alunos.sql). Esta
-- migration só documenta a decisão na própria tabela, não muda nenhum grant/policy.

comment on table public.responsaveis is
  'Portal do Responsável: acesso via /responsavel/[alunoId] autenticado por CPF';
