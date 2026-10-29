-- Gênezi Conecta — candidatura interna (TAREFA: remover "Candidatar via WhatsApp" direto,
-- aluno/externo passa a se candidatar dentro da plataforma; a empresa só vê o WhatsApp do
-- candidato depois de abrir os detalhes da candidatura).
--
-- Desvios do pedido original:
-- 1. Uma coluna só (perfil_id), não perfil_id + aluno_id: toda linha de perfis_conecta já tem
--    aluno_id preenchido (candidato externo também — ver cadastrarCandidatoExterno), então
--    perfil_id já identifica o candidato sozinho, sem precisar de duas FKs mutuamente
--    redundantes com dois UNIQUE separados.
-- 2. Nomes de coluna corrigidos pra bater com o schema real: empresas_conecta usa profile_id
--    (não user_id) e perfis_conecta usa aluno_id (não user_id) — ver 20260916800000_genezi_conecta.sql.
-- 3. Sem a policy "service_role_all ... USING (true)": service_role já bypassa RLS por conta
--    própria (REGRA do projeto, ver CLAUDE.md) — o que falta pra ele é GRANT de tabela, não
--    policy, mesmo padrão de toda outra tabela do Conecta.
-- 4. created_by adicionado (REGRA do projeto: toda tabela nova tem created_by) — ON DELETE
--    CASCADE porque quem insere aqui é o candidato (aluno ou externo), não só admin, e contas de
--    aluno/externo são excluídas rotineiramente (mesma regra já documentada no CLAUDE.md pro
--    caso de aulas_concluidas).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.candidaturas_conecta (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas_conecta(id) on delete cascade,
  perfil_id uuid not null references public.perfis_conecta(id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'visualizado', 'contato', 'rejeitado')),
  mensagem text,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vaga_id, perfil_id)
);

alter table public.candidaturas_conecta enable row level security;

create policy "Candidato ve proprias candidaturas"
  on public.candidaturas_conecta for select
  using (perfil_id in (select id from public.perfis_conecta where aluno_id = auth.uid()));

create policy "Candidato cria propria candidatura"
  on public.candidaturas_conecta for insert
  with check (perfil_id in (select id from public.perfis_conecta where aluno_id = auth.uid()));

create policy "Empresa ve candidaturas das proprias vagas"
  on public.candidaturas_conecta for select
  using (
    vaga_id in (
      select id from public.vagas_conecta where empresa_id in (
        select id from public.empresas_conecta where profile_id = auth.uid()
      )
    )
  );

create policy "Empresa atualiza status das proprias candidaturas"
  on public.candidaturas_conecta for update
  using (
    vaga_id in (
      select id from public.vagas_conecta where empresa_id in (
        select id from public.empresas_conecta where profile_id = auth.uid()
      )
    )
  );

create policy "Admins gerenciam candidaturas"
  on public.candidaturas_conecta for all using (public.is_admin());

-- update de status pra empresa é restrito à coluna (não pode reescrever vaga_id/perfil_id da
-- candidatura de outro jeito) — mesmo padrão de coluna restrita já usado em termos_legais.
grant select, insert on public.candidaturas_conecta to authenticated;
grant update (status) on public.candidaturas_conecta to authenticated;
grant select, insert, update, delete on public.candidaturas_conecta to service_role;

create trigger on_candidaturas_conecta_updated
  before update on public.candidaturas_conecta
  for each row execute function public.handle_updated_at();
