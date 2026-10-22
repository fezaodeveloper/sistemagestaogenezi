-- NÃO APLICADA — aplicar manualmente no SQL Editor

-- Senha em texto puro salva pra poder ser reenviada por WhatsApp na confirmação de matrícula
-- (o hash do Supabase Auth, usado pra autenticar de fato, nunca é legível de volta). NÃO é
-- preenchida no modo "so_email" do Portal do Aluno (Configurações > Portal do Aluno): nesse
-- modo a senha gerada é um token longo que ninguém deve conhecer/usar por design — salvá-la
-- aqui e mandá-la por WhatsApp anularia esse modo.

alter table public.alunos
  add column if not exists senha_portal text;

comment on column public.alunos.senha_portal is
  'Senha gerada pelo sistema em texto puro para envio por WhatsApp.
   Após o aluno fazer login e trocar a senha, este campo pode ser nulado.
   NÃO é o hash do Supabase Auth — é armazenada apenas para reenvio.';

grant insert (senha_portal) on public.alunos to authenticated;
grant update (senha_portal) on public.alunos to authenticated;
