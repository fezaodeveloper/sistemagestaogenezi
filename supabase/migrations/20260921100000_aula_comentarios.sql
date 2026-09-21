-- Comentários nas aulas do portal do aluno, com moderação pelo admin.
--
-- Fluxo: o aluno comenta na página da aula (/aluno/cursos/.../aulas/[aulaId]). Com
-- `portal_comentarios_moderacao = true` o comentário nasce 'pendente' e só aparece para os
-- colegas depois que o admin aprova; com `false` nasce 'aprovado'. O admin pode responder
-- (resposta_admin) e, ao responder, o aluno recebe uma notificação push.
--
-- QUEM DECIDE O STATUS É O BANCO, não o cliente: o aluno só tem grant de insert em
-- (aula_id, aluno_id, texto) e o trigger aula_comentarios_definir_status sobrescreve o status
-- conforme a configuração. Assim ninguém se auto-aprova pela API.
--
-- Recurso desligado por padrão (`portal_comentarios_ativo = false`): aplicar esta migration
-- não muda nada para os alunos até o admin ligar em Configurações > Portal do Aluno >
-- Comentários.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== configuracoes =====

alter table public.configuracoes
  add column if not exists portal_comentarios_ativo boolean not null default false,
  -- true = comentário exige aprovação do admin; false = aprovado automaticamente.
  add column if not exists portal_comentarios_moderacao boolean not null default true;

-- `authenticated` já tem SELECT na tabela inteira (o aluno lê as duas flags pra saber se
-- mostra a seção). `anon` não recebe nada: são dados internos do portal.
grant update (portal_comentarios_ativo, portal_comentarios_moderacao) on public.configuracoes to authenticated;

-- ===== helper: o aluno tem acesso a esta aula? =====
-- Mesma regra da RLS de aulas_concluidas: matrícula do aluno em turma do curso dono da aula.
-- security definer pra poder ser usada dentro de policies sem depender das policies de
-- matriculas/turmas/modulos do próprio chamador.

create or replace function public.aluno_acessa_aula(p_aula_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.aulas a
    join public.modulos mo on mo.id = a.modulo_id
    join public.turmas t on t.curso_id = mo.curso_id
    join public.matriculas m on m.turma_id = t.id
    where a.id = p_aula_id
      and m.aluno_id = auth.uid()
  );
$$;

revoke all on function public.aluno_acessa_aula(uuid) from public;
grant execute on function public.aluno_acessa_aula(uuid) to authenticated;

-- ===== aula_comentarios =====

create table public.aula_comentarios (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.aulas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  -- Resposta do instrutor/admin ao comentário.
  resposta_admin text check (resposta_admin is null or char_length(resposta_admin) between 1 and 2000),
  respondido_at timestamptz,
  -- created_by preenchido por papel NÃO-admin (o aluno): on delete cascade obrigatório
  -- (CLAUDE.md) — contas de aluno são excluídas rotineiramente e o FK padrão travaria.
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lista da aula (aprovados + próprios), mais recentes primeiro.
create index aula_comentarios_aula_idx on public.aula_comentarios (aula_id, created_at desc);
-- Painel de moderação: filtro por status, mais recentes primeiro.
create index aula_comentarios_status_idx on public.aula_comentarios (status, created_at desc);
create index aula_comentarios_aluno_idx on public.aula_comentarios (aluno_id);

create trigger on_aula_comentarios_updated
  before update on public.aula_comentarios
  for each row execute function public.handle_updated_at();

-- Define o status no INSERT a partir da configuração (o cliente não escolhe) e ignora
-- qualquer campo de moderação vindo do insert.
create or replace function public.aula_comentarios_definir_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moderacao boolean;
begin
  select c.portal_comentarios_moderacao into v_moderacao
  from public.configuracoes c
  where c.id = true;

  new.status := case when coalesce(v_moderacao, true) then 'pendente' else 'aprovado' end;
  new.resposta_admin := null;
  new.respondido_at := null;
  return new;
end;
$$;

create trigger aula_comentarios_definir_status
  before insert on public.aula_comentarios
  for each row execute function public.aula_comentarios_definir_status();

alter table public.aula_comentarios enable row level security;

-- SELECT
create policy "Admins podem ver comentarios"
  on public.aula_comentarios for select
  using (public.is_admin());

create policy "Alunos veem os proprios comentarios"
  on public.aula_comentarios for select
  using (aluno_id = auth.uid());

-- Comentários aprovados dos colegas: só das aulas a que o aluno tem acesso.
create policy "Alunos veem comentarios aprovados das aulas do curso"
  on public.aula_comentarios for select
  using (status = 'aprovado' and public.aluno_acessa_aula(aula_id));

-- INSERT: o próprio aluno, numa aula do curso dele, com o recurso ligado.
create policy "Alunos podem comentar nas aulas do curso"
  on public.aula_comentarios for insert
  with check (
    aluno_id = auth.uid()
    and public.aluno_acessa_aula(aula_id)
    and exists (select 1 from public.configuracoes c where c.id = true and c.portal_comentarios_ativo)
  );

-- UPDATE: só o admin (moderar/responder).
create policy "Admins podem moderar comentarios"
  on public.aula_comentarios for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: admin exclui qualquer um; o aluno só o próprio comentário já aprovado.
create policy "Admins podem excluir comentarios"
  on public.aula_comentarios for delete
  using (public.is_admin());

create policy "Alunos excluem o proprio comentario aprovado"
  on public.aula_comentarios for delete
  using (aluno_id = auth.uid() and status = 'aprovado');

-- ===== grants =====
grant select on public.aula_comentarios to authenticated;
-- created_by/status/resposta_* ficam de fora: default (auth.uid()) e trigger.
grant insert (aula_id, aluno_id, texto) on public.aula_comentarios to authenticated;
grant update (status, resposta_admin, respondido_at) on public.aula_comentarios to authenticated;
grant delete on public.aula_comentarios to authenticated;

grant select, insert, update, delete on public.aula_comentarios to service_role;
