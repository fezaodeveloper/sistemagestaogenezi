-- NÃO APLICADA

-- Vínculo manual aluno <-> curso gratuito, independente de matrícula paga.
--
-- matriculas.curso_bonus_id já cobre "bônus anexado a uma matrícula paga
-- específica, escolhido no wizard" (ver commit a87616d: o bônus nunca passa
-- por turma_id) — mas é uma FK única por matrícula, não suporta conceder/
-- revogar curso gratuito direto pro aluno sem editar a matrícula, nem dar a
-- ele mais de um curso gratuito independente de quantas matrículas pagas
-- tenha. Esta tabela nova resolve isso: admin atribui/remove livremente,
-- aluno pode acumular N cursos gratuitos aqui, e nada disso toca a matrícula
-- principal (ela nem é referenciada).
--
-- aluno_id aponta pra public.alunos (mesmo padrão de matriculas.aluno_id,
-- não public.profiles) com on delete cascade: contas de aluno são excluídas
-- rotineiramente (deleteAluno em /admin/alunos) — sem cascade, excluir um
-- aluno com curso gratuito atribuído falharia por violação de FK (mesmo bug
-- já documentado em aulas_concluidas, CLAUDE.md). curso_id também em cascade:
-- se o curso gratuito for excluído, o vínculo órfão não faz sentido mantido.
create table public.aluno_cursos_gratuitos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  curso_id uuid not null references public.cursos (id) on delete cascade,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (aluno_id, curso_id)
);

create index aluno_cursos_gratuitos_aluno_id_idx on public.aluno_cursos_gratuitos (aluno_id);
create index aluno_cursos_gratuitos_curso_id_idx on public.aluno_cursos_gratuitos (curso_id);

alter table public.aluno_cursos_gratuitos enable row level security;

create policy "Admins gerenciam vinculos de curso gratuito"
  on public.aluno_cursos_gratuitos for all using (public.is_admin());

-- O aluno não gerencia nada aqui (sem insert/delete pra ele), só precisa
-- enxergar os próprios vínculos pra o portal (/aluno) montar a lista de
-- cursos gratuitos que ele tem acesso.
create policy "Aluno ve os proprios vinculos de curso gratuito"
  on public.aluno_cursos_gratuitos for select
  using (aluno_id = auth.uid());

grant select on public.aluno_cursos_gratuitos to authenticated;
grant insert, delete on public.aluno_cursos_gratuitos to authenticated;
