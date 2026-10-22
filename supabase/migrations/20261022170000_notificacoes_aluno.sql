-- NÃO APLICADA

-- Histórico de notificações push do aluno, pra alimentar o sininho do portal (/aluno). Não
-- existia tabela nenhuma pra isso antes — o envio push (src/lib/push/enviar.ts) sempre foi
-- fire-and-forget via web-push, sem persistir nada.
--
-- aluno_id referencia public.alunos (não profiles): alunos.id já É o auth.uid() do usuário
-- (alunos.id references profiles(id)), então a RLS compara direto com auth.uid(), sem precisar
-- de subquery via uma coluna "user_id" (há uma coluna legada com esse nome em alunos, mas é
-- redundante com o próprio id — não é referenciada aqui).
--
-- on delete cascade: contas de aluno são excluídas rotineiramente (deleteAluno em
-- /admin/alunos) — sem cascade, excluir um aluno com notificação pendente falharia por violação
-- de FK (mesmo bug já documentado em aulas_concluidas, CLAUDE.md).
create table public.notificacoes_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  titulo text not null,
  corpo text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notificacoes_aluno_aluno_id_idx on public.notificacoes_aluno (aluno_id, created_at desc);

alter table public.notificacoes_aluno enable row level security;

create policy "Aluno ve as proprias notificacoes"
  on public.notificacoes_aluno for select
  using (aluno_id = auth.uid());

create policy "Aluno atualiza as proprias notificacoes"
  on public.notificacoes_aluno for update
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

create policy "Aluno exclui as proprias notificacoes"
  on public.notificacoes_aluno for delete
  using (aluno_id = auth.uid());

-- Sem policy/grant de insert pra authenticated: só o client admin (service_role, que bypassa
-- RLS) grava notificação, no momento em que o push é enviado (ver enviarPushPara). O aluno nunca
-- cria a própria notificação.
grant select, update, delete on public.notificacoes_aluno to authenticated;

-- service_role bypassa RLS mas não grants de tabela (ver CLAUDE.md) — precisa do grant explícito
-- pra conseguir inserir o histórico a partir de enviarPushPara (createAdminClient()).
grant select, insert, update, delete on public.notificacoes_aluno to service_role;
