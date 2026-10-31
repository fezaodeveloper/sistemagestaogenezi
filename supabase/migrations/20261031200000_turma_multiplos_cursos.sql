-- TAREFA múltiplos cursos por turma — ver resumo da tarefa pras PERGUNTAS DE FATO e os desvios
-- abaixo.
--
-- DESVIO DO SQL ORIGINAL DA TAREFA — matriculas.curso_id NÃO EXISTE hoje (confirmado: só
-- `matriculas.turma_id`, o curso é sempre resolvido via turma_id -> turmas.curso_id; já
-- documentado antes, na tarefa "filtros de turma e curso na lista de matrículas"). O CONTEXTO
-- desta tarefa listava "matriculas (turma_id, curso_id)" como se a coluna já existisse — não
-- existe. Sem ela, a PARTE 2 ("ao matricular... salvar em matriculas.curso_id") não tem onde
-- gravar qual dos N cursos da turma o aluno escolheu — por isso esta migration ADICIONA essa
-- coluna (nullable: matrículas antigas/turmas de 1 curso continuam sem precisar dela, o curso
-- some via turma_id -> turmas.curso_id como sempre).

-- ===== Tabela de vínculo N:N =====

create table if not exists public.turma_cursos (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id) on delete cascade,
  curso_id uuid not null references public.cursos (id) on delete cascade,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (turma_id, curso_id)
);

create index if not exists idx_turma_cursos_turma on public.turma_cursos (turma_id, ordem);
create index if not exists idx_turma_cursos_curso on public.turma_cursos (curso_id);

-- Migra o curso_id existente em turmas pra tabela nova (ordem 0 = "principal").
insert into public.turma_cursos (turma_id, curso_id, ordem)
select id, curso_id, 0 from public.turmas where curso_id is not null
on conflict (turma_id, curso_id) do nothing;

-- Mantém turmas.curso_id por compatibilidade (nunca mais NOT NULL — ver PARTE 2 da tarefa:
-- "Manter turmas.curso_id = primeiro curso adicionado"). Todo o código legado (dezenas de JOINs
-- turmas->cursos espalhados pelo projeto, fora do escopo desta tarefa) continua funcionando sem
-- nenhuma mudança, sempre vendo o curso "principal".
alter table public.turmas alter column curso_id drop not null;

alter table public.turma_cursos enable row level security;

create policy "admin_all" on public.turma_cursos
  using (public.is_admin()) with check (public.is_admin());

-- RLS não basta — toda tabela nova precisa de grant explícito por operação (CLAUDE.md).
grant select, insert, update, delete on public.turma_cursos to authenticated;
grant select, insert, update, delete on public.turma_cursos to service_role;

-- ===== matriculas.curso_id (coluna nova — ver desvio no topo) =====
--
-- "Qual curso este aluno vai fazer" quando a turma tem 2+ cursos (PARTE 2). Nullable: só
-- preenchida quando o wizard sabe o curso (sempre sabe, na verdade — a Etapa 2 já pede o curso
-- antes de filtrar as turmas; isto só passou a ser GRAVADO agora). on delete set null (não
-- cascade): excluir um curso não deve apagar o histórico de matrícula do aluno, só perder essa
-- referência específica — mesmo critério already used por curso_bonus_id
-- (20261022100000_matricula_curso_bonus.sql).
alter table public.matriculas add column if not exists curso_id uuid references public.cursos (id) on delete set null;

create index if not exists idx_matriculas_curso_id on public.matriculas (curso_id);

-- matriculas usa grants POR COLUNA (não grant de tabela inteira) — confirmado em
-- 20260801130000_create_matriculas.sql e replicado em toda coluna nova desde então (ex.:
-- curso_bonus_id). Sem isto, gravar matriculas.curso_id daria "permission denied for column".
grant insert (curso_id) on public.matriculas to authenticated;
grant update (curso_id) on public.matriculas to authenticated;

-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.
