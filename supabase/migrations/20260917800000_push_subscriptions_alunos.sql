-- Item 7 do roadmap (PWA completo) — permite que o próprio aluno se
-- inscreva em push notifications (endpoint do navegador dele), reaproveitando
-- a tabela push_subscriptions já usada só por admin até aqui
-- (20260909400000_historico_alteracoes.sql).
--
-- aluno_id null continua identificando uma subscription de admin — ver
-- enviarPushAdmin/enviarPushAlunos em src/lib/push/enviar.ts, que agora
-- filtram por essa coluna pra nunca misturar os dois públicos.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

alter table public.push_subscriptions
  add column if not exists aluno_id uuid references public.alunos (id) on delete cascade;

-- on delete cascade obrigatório aqui (CLAUDE.md): aluno_id é preenchido por
-- um papel não-admin (o próprio aluno, em salvarPushSubscriptionAluno) e
-- contas de aluno são excluídas rotineiramente pelo admin.

create policy "Alunos gerenciam a própria subscription push"
  on public.push_subscriptions for all
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

-- grant select, insert, delete on public.push_subscriptions to authenticated
-- já cobre a tabela inteira (sem lista de colunas) desde
-- 20260909400000_historico_alteracoes.sql — não precisa de grant novo pra
-- aluno_id.
