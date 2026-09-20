-- Opt-out (descadastro) de e-mail marketing — exigência da LGPD: quem pede pra não
-- receber mais e-mails de marketing precisa ser respeitado em TODA campanha futura.
--
-- 1) alunos.email_marketing_ativo — false = não recebe campanhas. É o que a lista de
--    destinatários (getDestinatarios) consulta primeiro. Só o servidor (service_role)
--    altera: o link público de descadastro e o botão "Remover da lista" do admin.
--
-- 2) email_descadastros — o REGISTRO de quem se descadastrou (e-mail, quando, motivo
--    opcional). Guarda o e-mail, não só o aluno: assim o pedido vale mesmo se o e-mail
--    for cadastrado de novo em outro aluno, ou se o aluno for excluído (aluno_id vira
--    null, o e-mail continua bloqueado). Sempre em minúsculas (check abaixo).
--
-- Acesso: a página pública roda com service_role (lê e escreve); o admin só LÊ pela
-- sessão (a reativação é feita por Server Action com service_role). Por isso o único
-- grant de authenticated é select. Sem "created_by" (convenção CLAUDE.md): as linhas
-- nascem de um visitante sem conta.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.alunos
  add column if not exists email_marketing_ativo boolean not null default true;

create table public.email_descadastros (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (email = lower(email)),
  aluno_id uuid references public.alunos (id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create index email_descadastros_created_at_idx on public.email_descadastros (created_at desc);

alter table public.email_descadastros enable row level security;

-- service_role bypassa RLS; o admin só lê.
create policy "Admins leem descadastros de e-mail"
  on public.email_descadastros for select
  using (public.is_admin());

grant select on public.email_descadastros to authenticated;
grant select, insert, update, delete on public.email_descadastros to service_role;
