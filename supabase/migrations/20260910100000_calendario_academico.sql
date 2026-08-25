-- Calendário Acadêmico: eventos administrativos (aula/prova/evento/outro) e
-- feriados sincronizados manualmente da BrasilAPI (endpoint público, sem
-- auth — mesma filosofia do ViaCEP já usado no cadastro de aluno). A
-- sincronização nunca roda sozinha: é sempre um botão que o admin aciona
-- (ver sincronizarFeriadosAction em src/app/admin/calendario/actions.ts).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.eventos_calendario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('aula', 'prova', 'evento', 'outro', 'feriado')),
  tipo_feriado text check (tipo_feriado in ('nacional', 'estadual', 'municipal')),
  data_inicio date not null,
  data_fim date,
  horario_inicio text,
  horario_fim text,
  curso_id uuid references public.cursos (id) on delete set null,
  turma_id uuid references public.turmas (id) on delete set null,
  abrangencia text not null default 'todos' check (abrangencia in ('todos', 'curso', 'turma')),
  gera_notificacao boolean not null default false,
  impacta_aulas boolean not null default false,
  bloqueia_frequencia boolean not null default false,
  observacoes text,
  origem text not null default 'manual' check (origem in ('manual', 'api')),
  -- Só admin cria evento (ver policies abaixo) — FK aponta pra profiles com
  -- o mesmo padrão de todas as outras tabelas do projeto (ver CLAUDE.md),
  -- não pra auth.users diretamente. Sem "on delete cascade": created_by
  -- nunca é uma conta de aluno aqui, e conta admin não é excluída pelo app.
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_calendario_datas_check check (data_fim is null or data_fim >= data_inicio)
);

create index eventos_calendario_data_inicio_idx on public.eventos_calendario (data_inicio);
create index eventos_calendario_tipo_idx on public.eventos_calendario (tipo);
create index eventos_calendario_curso_id_idx on public.eventos_calendario (curso_id);
create index eventos_calendario_turma_id_idx on public.eventos_calendario (turma_id);

-- Dedup da sincronização com a BrasilAPI: sincronizarFeriados() faz upsert
-- por (nome, data_inicio) — só entre linhas origem='api', pra um feriado
-- manual com nome/data coincidentes não ser silenciosamente sobrescrito.
create unique index eventos_calendario_feriado_api_uidx
  on public.eventos_calendario (nome, data_inicio)
  where origem = 'api';

alter table public.eventos_calendario enable row level security;

create policy "Admins podem ver eventos do calendário"
  on public.eventos_calendario for select using (public.is_admin());

-- "Aluno pode apenas SELECT" (sem escopo por matrícula, ao contrário de
-- matriculas/turmas): o calendário é institucional, todo aluno deve ver
-- todos os eventos, não só os da própria turma.
create policy "Alunos podem ver eventos do calendário"
  on public.eventos_calendario for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'aluno')
  );

create policy "Admins podem criar eventos do calendário"
  on public.eventos_calendario for insert with check (public.is_admin());

create policy "Admins podem atualizar eventos do calendário"
  on public.eventos_calendario for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir eventos do calendário"
  on public.eventos_calendario for delete using (public.is_admin());

-- Reaproveita a função já criada na migration de profiles (Fase 2).
create trigger on_eventos_calendario_updated
  before update on public.eventos_calendario
  for each row execute function public.handle_updated_at();

grant select on public.eventos_calendario to authenticated;

grant insert (
  nome, tipo, tipo_feriado, data_inicio, data_fim, horario_inicio, horario_fim,
  curso_id, turma_id, abrangencia, gera_notificacao, impacta_aulas,
  bloqueia_frequencia, observacoes, origem
) on public.eventos_calendario to authenticated;

grant update (
  nome, tipo, tipo_feriado, data_inicio, data_fim, horario_inicio, horario_fim,
  curso_id, turma_id, abrangencia, gera_notificacao, impacta_aulas,
  bloqueia_frequencia, observacoes, origem
) on public.eventos_calendario to authenticated;

grant delete on public.eventos_calendario to authenticated;
