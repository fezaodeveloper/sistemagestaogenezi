-- Gênezi Conecta — Storage: logo da empresa (público) e currículo do
-- candidato (privado).
--
-- Nome do arquivo ajustado de 20260912200000 (pedido original) para
-- 20260916900000: 20260912200000_configuracoes_escola.sql já existe.
--
-- Policies reescritas em relação ao SQL original pedido: as políticas
-- fornecidas (bucket_id = 'X' and auth.role() = 'authenticated') liberam
-- QUALQUER usuário autenticado — de qualquer role — a subir/apagar
-- QUALQUER arquivo no bucket, inclusive o de outra empresa/aluno, e a
-- policy de SELECT do currículo (dado pessoal, REGRA da tarefa) deixaria
-- qualquer aluno ver o currículo de outro aluno. Reescrito seguindo o
-- mesmo padrão já usado em storage.objects neste projeto (ver
-- 20260901200000_foto_aluno.sql: path fixo por dono + checagem de role),
-- restringindo insert/delete ao próprio dono (por path fixo) e o select do
-- currículo a só empresa/admin.
--
-- Mostrar SQL — NÃO aplicar.

insert into storage.buckets (id, name, public)
values ('logos-conecta', 'logos-conecta', true);

-- Path fixo por empresa (logos/{profile_id}.{ext}) — mesmo padrão
-- anti-acúmulo/upsert já usado em fotos-alunos e escola-logo (upsert:true
-- sobrescreve direto, sem precisar de policy de "remover antes").
create policy "Empresa envia propria logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos-conecta'
    and name in (
      'logos/' || auth.uid()::text || '.jpg',
      'logos/' || auth.uid()::text || '.png',
      'logos/' || auth.uid()::text || '.webp'
    )
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'empresa')
  );

-- Sem esta policy, só o PRIMEIRO upload funcionaria — trocar a logo depois
-- faz upsert sobre um objeto que já existe, e o Storage trata isso como
-- update, não insert (mesmo motivo documentado em 20260901200000_foto_aluno.sql).
create policy "Empresa atualiza propria logo"
  on storage.objects for update
  using (
    bucket_id = 'logos-conecta'
    and name in (
      'logos/' || auth.uid()::text || '.jpg',
      'logos/' || auth.uid()::text || '.png',
      'logos/' || auth.uid()::text || '.webp'
    )
  );

create policy "Empresa remove propria logo"
  on storage.objects for delete
  using (
    bucket_id = 'logos-conecta'
    and name in (
      'logos/' || auth.uid()::text || '.jpg',
      'logos/' || auth.uid()::text || '.png',
      'logos/' || auth.uid()::text || '.webp'
    )
  );

create policy "Logo de empresa e publica para leitura"
  on storage.objects for select
  using (bucket_id = 'logos-conecta');

-- ===== currículos (privado — dado pessoal do aluno) =====

insert into storage.buckets (id, name, public)
values ('curriculos-conecta', 'curriculos-conecta', false);

create policy "Aluno envia proprio curriculo"
  on storage.objects for insert
  with check (
    bucket_id = 'curriculos-conecta'
    and name = ('curriculos/' || auth.uid()::text || '.pdf')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'aluno')
  );

create policy "Aluno atualiza proprio curriculo"
  on storage.objects for update
  using (
    bucket_id = 'curriculos-conecta'
    and name = ('curriculos/' || auth.uid()::text || '.pdf')
  );

create policy "Aluno remove proprio curriculo"
  on storage.objects for delete
  using (
    bucket_id = 'curriculos-conecta'
    and name = ('curriculos/' || auth.uid()::text || '.pdf')
  );

-- Restrito a empresa/admin (não "authenticated" genérico, como no pedido
-- original) — currículo é dado pessoal, um aluno não deve conseguir ler o
-- currículo de outro aluno via Storage.
create policy "Empresas e admins veem curriculos"
  on storage.objects for select
  using (
    bucket_id = 'curriculos-conecta'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('empresa', 'admin')
    )
  );
