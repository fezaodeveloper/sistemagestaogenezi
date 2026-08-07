-- Conclusão manual de aula pelo aluno (botão "Marcar aula como concluída").
-- Vinculada à matrícula, não direto ao aluno — mesmo raciocínio de
-- presencas: o mesmo aluno pode ter matrículas simultâneas em turmas
-- diferentes. Primeira tabela do projeto em que o próprio aluno escreve
-- seus dados (até hoje RLS de aluno só tinha select) — por isso o insert
-- valida não só a dona da matrícula, mas também que a aula realmente
-- pertence ao curso daquela matrícula (via turma), evitando dado
-- inconsistente.

create table public.aulas_concluidas (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aula_id uuid not null references public.aulas (id) on delete cascade,
  concluida_em timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) default auth.uid()
);

create index aulas_concluidas_matricula_id_idx on public.aulas_concluidas (matricula_id);
create index aulas_concluidas_aula_id_idx on public.aulas_concluidas (aula_id);

-- Marcar a mesma aula concluída duas vezes na mesma matrícula deve ser
-- idempotente, não duplicar linha.
create unique index aulas_concluidas_matricula_aula_uidx
  on public.aulas_concluidas (matricula_id, aula_id);

alter table public.aulas_concluidas enable row level security;

create policy "Admins podem ver aulas concluidas"
  on public.aulas_concluidas for select using (public.is_admin());

create policy "Alunos podem ver suas próprias aulas concluídas"
  on public.aulas_concluidas for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = aulas_concluidas.matricula_id and m.aluno_id = auth.uid()
    )
  );

create policy "Alunos podem marcar suas próprias aulas concluídas"
  on public.aulas_concluidas for insert
  with check (
    exists (
      select 1 from public.matriculas m
      where m.id = aulas_concluidas.matricula_id and m.aluno_id = auth.uid()
    )
    and exists (
      select 1
      from public.aulas a
      join public.modulos mo on mo.id = a.modulo_id
      join public.turmas t on t.curso_id = mo.curso_id
      join public.matriculas m on m.turma_id = t.id
      where a.id = aulas_concluidas.aula_id and m.id = aulas_concluidas.matricula_id
    )
  );

create policy "Alunos podem desmarcar suas próprias aulas concluídas"
  on public.aulas_concluidas for delete
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = aulas_concluidas.matricula_id and m.aluno_id = auth.uid()
    )
  );

grant select on public.aulas_concluidas to authenticated;
grant insert (matricula_id, aula_id) on public.aulas_concluidas to authenticated;
grant delete on public.aulas_concluidas to authenticated;
