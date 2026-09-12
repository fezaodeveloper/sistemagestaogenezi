-- Corrige a policy de upload de currículo (storage.objects) — a checagem
-- extra "exists (select 1 from profiles where id = auth.uid() and role =
-- 'aluno')" estava causando falha de RLS no upload mesmo para o aluno dono
-- do arquivo. O path fixo (curriculos/{auth.uid()}.pdf) já garante sozinho
-- que só o dono da sessão grava no próprio arquivo — a checagem de role
-- era redundante como camada de segurança e a causa provável da falha.
--
-- Nome do arquivo ajustado de 20260913100000 (pedido original) para
-- 20260917000000: 20260913100000_treinamentos.sql já existe.
--
-- Mostrar SQL — NÃO aplicar.

drop policy if exists "Aluno envia proprio curriculo" on storage.objects;
drop policy if exists "Aluno atualiza proprio curriculo" on storage.objects;

create policy "Aluno envia proprio curriculo"
  on storage.objects for insert
  with check (
    bucket_id = 'curriculos-conecta'
    and name = ('curriculos/' || auth.uid()::text || '.pdf')
  );

create policy "Aluno atualiza proprio curriculo"
  on storage.objects for update
  using (
    bucket_id = 'curriculos-conecta'
    and name = ('curriculos/' || auth.uid()::text || '.pdf')
  );
