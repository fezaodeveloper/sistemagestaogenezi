-- TAREFA 2B/2E — anexos e edição/exclusão de mensagens no chat interno.
-- Mostrada para revisão, NÃO aplicada nesta rodada.
--
-- Duas correções em relação ao SQL originalmente pedido:
-- 1. A tabela do chat se chama `mensagens_chat` (ver
--    20260906100000_create_chat_interno.sql), não `mensagens` — não existe
--    tabela `public.mensagens` neste projeto.
-- 2. Adicionadas as policies/grants de UPDATE e DELETE em `mensagens_chat`
--    (TAREFA 2E, editarMensagem/excluirMensagem) — sem elas, RLS bloqueia
--    qualquer update/delete por padrão, mesmo com o GRANT de coluna.

-- ===== Bucket para arquivos do chat =====

insert into storage.buckets (id, name, public)
values ('chat-arquivos', 'chat-arquivos', true);

create policy "Admins enviam arquivos no chat"
  on storage.objects for insert
  with check (bucket_id = 'chat-arquivos' and public.is_admin());

create policy "Alunos podem ver arquivos do chat"
  on storage.objects for select
  using (bucket_id = 'chat-arquivos');

create policy "Admins podem excluir arquivos do chat"
  on storage.objects for delete
  using (bucket_id = 'chat-arquivos' and public.is_admin());

-- ===== Coluna de arquivo em mensagens_chat =====

alter table public.mensagens_chat
  add column if not exists arquivo_url text,
  add column if not exists arquivo_nome text,
  add column if not exists arquivo_tipo text;

grant insert (arquivo_url, arquivo_nome, arquivo_tipo)
  on public.mensagens_chat to authenticated;

-- ===== Editar/excluir mensagem (TAREFA 2E) — só a própria mensagem =====

create policy "Remetente pode editar a propria mensagem"
  on public.mensagens_chat for update
  using (remetente_id = auth.uid())
  with check (remetente_id = auth.uid());

create policy "Remetente pode excluir a propria mensagem"
  on public.mensagens_chat for delete
  using (remetente_id = auth.uid());

grant update (texto) on public.mensagens_chat to authenticated;
grant delete on public.mensagens_chat to authenticated;
