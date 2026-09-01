-- Assinatura visual do diretor(a) nos contratos em PDF, e regeneração do
-- PDF com rodapé de aceite digital quando o aluno assina (ver
-- src/lib/contratos/pdf.tsx e src/app/aluno/contrato/actions.ts).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== Configurações: assinatura do diretor(a) =====

alter table public.configuracoes
  add column if not exists assinatura_admin_url text,
  add column if not exists assinatura_admin_path text,
  add column if not exists nome_diretor text;

grant update (assinatura_admin_url, assinatura_admin_path, nome_diretor)
  on public.configuracoes to authenticated;

-- ===== Bucket da assinatura do diretor(a) =====
-- Mesmo padrão do bucket "escola-logo": público (a imagem é embutida no
-- PDF do contrato, gerado server-side pelo client admin, e precisa de uma
-- URL acessível sem sessão), com insert/update/delete restritos a admin
-- via policies em storage.objects.

insert into storage.buckets (id, name, public) values ('assinaturas', 'assinaturas', true);

create policy "Admins enviam assinatura do diretor"
  on storage.objects for insert
  with check (bucket_id = 'assinaturas' and public.is_admin());
create policy "Admins atualizam assinatura do diretor"
  on storage.objects for update
  using (bucket_id = 'assinaturas' and public.is_admin());
create policy "Admins excluem assinatura do diretor"
  on storage.objects for delete
  using (bucket_id = 'assinaturas' and public.is_admin());
-- Policy de select necessária pro upsert:true no upload funcionar (mesmo
-- motivo do 20260916300000_escola_logo_select_policy.sql) — já incluída
-- aqui desde a criação do bucket, ao contrário do caso da logo, em que
-- ela só foi adicionada depois de o bug aparecer.
create policy "Admins veem assinatura do diretor"
  on storage.objects for select
  using (bucket_id = 'assinaturas' and public.is_admin());

-- ===== Grant faltante: regeneração do PDF do contrato ao assinar =====
-- assinarContrato (src/app/aluno/contrato/actions.ts) atualiza
-- conteudo_pdf_base64 com o client autenticado do próprio aluno (não o
-- client admin) depois de regenerar o PDF com o rodapé de aceite digital.
-- A migration original do sistema de contratos
-- (20260831100000_contrato_matricula.sql) só liberou update de
-- (aceito_em, aceito_ip, status) pra authenticated — sem esse grant, essa
-- atualização falharia com "permission denied" pra coluna.
grant update (conteudo_pdf_base64)
  on public.contratos_assinados to authenticated;
