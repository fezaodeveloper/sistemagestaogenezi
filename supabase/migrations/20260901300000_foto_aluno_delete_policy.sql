-- Policy de DELETE faltante em storage.objects pro aluno excluir a
-- própria foto (removerFotoPropria, src/app/aluno/perfil/actions.ts).
--
-- 20260901200000_foto_aluno.sql deu ao aluno policies de insert e update
-- sobre o próprio caminho fixo (fotos/{auth.uid()}.jpg), mas nenhuma de
-- delete — só o admin tinha "Admins excluem fotos de alunos". Sem esta
-- policy, a chamada a supabase.storage.from('fotos-alunos').remove([...])
-- feita pelo próprio aluno falha silenciosamente (RLS bloqueia, o arquivo
-- nunca é removido) mesmo com o UPDATE do banco (foto_url/foto_path)
-- funcionando — o registro fica limpo, mas o arquivo antigo continua
-- publicamente acessível pela URL antiga.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create policy "Aluno pode excluir a propria foto"
  on storage.objects for delete
  using (
    bucket_id = 'fotos-alunos'
    and name = ('fotos/' || auth.uid()::text || '.jpg')
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'aluno'
    )
  );
