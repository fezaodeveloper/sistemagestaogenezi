-- Foto do aluno — upload pelo admin (aluno-edit-form) ou pelo próprio
-- aluno (portal, /aluno/perfil).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== Bucket das fotos de alunos =====

insert into storage.buckets (id, name, public) values ('fotos-alunos', 'fotos-alunos', true);

create policy "Admins enviam fotos de alunos"
  on storage.objects for insert
  with check (bucket_id = 'fotos-alunos' and public.is_admin());
create policy "Admins atualizam fotos de alunos"
  on storage.objects for update
  using (bucket_id = 'fotos-alunos' and public.is_admin());
create policy "Admins excluem fotos de alunos"
  on storage.objects for delete
  using (bucket_id = 'fotos-alunos' and public.is_admin());
create policy "Fotos sao publicas para leitura"
  on storage.objects for select
  using (bucket_id = 'fotos-alunos');

-- Aluno pode subir a própria foto, sempre no mesmo caminho fixo
-- (fotos/{auth.uid()}.jpg) — mesmo padrão anti-acúmulo dos demais buckets
-- de imagem do projeto (nome fixo, upload sobrescreve).
create policy "Aluno pode enviar propria foto"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos-alunos'
    and name = ('fotos/' || auth.uid()::text || '.jpg')
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'aluno'
    )
  );
-- Policy de update adicionada em relação ao pedido original: sem ela, só o
-- PRIMEIRO upload do aluno funcionaria — trocar a foto depois (TAREFA 4D,
-- "Alterar foto") faz um upsert sobre um objeto que já existe, e o Storage
-- trata isso como update, não insert. Mesmo escopo de nome fixo da policy
-- de insert acima.
create policy "Aluno pode atualizar propria foto"
  on storage.objects for update
  using (
    bucket_id = 'fotos-alunos'
    and name = ('fotos/' || auth.uid()::text || '.jpg')
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'aluno'
    )
  );

-- ===== Colunas de foto em alunos =====

alter table public.alunos
  add column if not exists foto_url text,
  add column if not exists foto_path text;

grant update (foto_url, foto_path) on public.alunos to authenticated;

-- Policies adicionadas em relação ao pedido original: a tabela public.alunos
-- só tinha policies de admin até aqui (create policy "Admins podem ver/
-- atualizar alunos" em 20260801120000_create_alunos.sql) — nenhum aluno
-- conseguia ler ou atualizar a própria linha. Sem essas duas, TAREFA 4D
-- (upload da própria foto pelo portal) falharia silenciosamente: o
-- SELECT em /aluno/perfil não veria a própria foto, e o UPDATE de
-- foto_url/foto_path seria bloqueado pelo RLS mesmo com o grant de coluna
-- acima (grant e policy são checados juntos, não um no lugar do outro).
create policy "Aluno pode ver o proprio cadastro"
  on public.alunos for select using (id = auth.uid());
create policy "Aluno pode atualizar a propria foto"
  on public.alunos for update using (id = auth.uid()) with check (id = auth.uid());
