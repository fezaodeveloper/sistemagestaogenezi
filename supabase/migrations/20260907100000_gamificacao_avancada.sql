-- Gamificação avançada: medalhas progressivas (bronze/prata/ouro/diamante),
-- ofensiva inteligente baseada no cronograma, e cronograma de aulas.

-- ===== PARTE 1: badges progressivos (catálogo) =====

insert into public.badges (id, nome, descricao, icone, ordem) values
-- Ofensiva (sequência de aulas programadas cumpridas)
('ofensiva_bronze', 'Ofensiva Bronze', 'Cumpriu 3 aulas seguidas no cronograma.', '🔥', 10),
('ofensiva_prata', 'Ofensiva Prata', 'Cumpriu 7 aulas seguidas no cronograma.', '🔥', 11),
('ofensiva_ouro', 'Ofensiva Ouro', 'Cumpriu 15 aulas seguidas no cronograma.', '🔥', 12),
('ofensiva_diamante', 'Ofensiva Diamante', 'Cumpriu 30 aulas seguidas no cronograma.', '💎', 13),
-- Frequência total
('frequencia_bronze', 'Frequente Bronze', 'Marcou presença em 10 aulas.', '✅', 14),
('frequencia_prata', 'Frequente Prata', 'Marcou presença em 25 aulas.', '✅', 15),
('frequencia_ouro', 'Frequente Ouro', 'Marcou presença em 50 aulas.', '⭐', 16),
('frequencia_diamante', 'Frequente Diamante', 'Marcou presença em 100 aulas.', '💫', 17),
-- Módulos concluídos
('modulos_bronze', 'Estudioso Bronze', 'Concluiu 2 módulos.', '📚', 18),
('modulos_prata', 'Estudioso Prata', 'Concluiu 5 módulos.', '📚', 19),
('modulos_ouro', 'Estudioso Ouro', 'Concluiu 10 módulos.', '📖', 20),
('modulos_diamante', 'Estudioso Diamante', 'Concluiu 20 módulos.', '🏆', 21),
-- Quizzes completados
('quiz_bronze', 'Quiz Bronze', 'Completou 5 quizzes.', '🎯', 22),
('quiz_prata', 'Quiz Prata', 'Completou 15 quizzes.', '🎯', 23),
('quiz_ouro', 'Quiz Ouro', 'Completou 30 quizzes.', '🏅', 24),
('quiz_diamante', 'Quiz Diamante', 'Completou 50 quizzes.', '🥇', 25),
-- Pontos acumulados
('pontos_bronze', 'Colecionador Bronze', 'Acumulou 500 pontos.', '💰', 26),
('pontos_prata', 'Colecionador Prata', 'Acumulou 1000 pontos.', '💰', 27),
('pontos_ouro', 'Colecionador Ouro', 'Acumulou 2500 pontos.', '💎', 28),
('pontos_diamante', 'Colecionador Diamante', 'Acumulou 5000 pontos.', '👑', 29)
on conflict (id) do nothing;

-- ===== PARTE 2: ofensiva inteligente =====
-- Sem created_by: tabela de cache calculado, nunca escrita por um usuário
-- (só pelo cron/login via client admin) — mesmo padrão de indices_evasao
-- (migration 20260914200000). Grants de escrita só pra service_role, já
-- que quem calcula (atualizarOfensivasAluno) sempre usa o client admin,
-- mesmo quando disparado a partir da sessão do próprio aluno.

create table public.ofensivas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  matricula_id uuid not null references public.matriculas(id) on delete cascade,
  ofensiva_atual integer not null default 0,
  ofensiva_maxima integer not null default 0,
  ultima_aula_cumprida date,
  calculado_em timestamptz not null default now(),
  unique (aluno_id, matricula_id)
);

alter table public.ofensivas enable row level security;
create policy "Admins veem ofensivas" on public.ofensivas for select using (public.is_admin());
create policy "Aluno ve propria ofensiva" on public.ofensivas for select using (aluno_id = auth.uid());
grant select on public.ofensivas to authenticated;
grant select, insert, update, delete on public.ofensivas to service_role;

-- ===== PARTE 3: cronograma de aulas =====

create table public.cronograma_aulas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  aula_id uuid not null references public.aulas(id) on delete cascade,
  data_aula date not null,
  eh_feriado boolean not null default false,
  cancelada boolean not null default false,
  observacoes text,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (turma_id, data_aula, aula_id)
);

create index cronograma_turma_data_idx on public.cronograma_aulas(turma_id, data_aula);
alter table public.cronograma_aulas enable row level security;
create policy "Admins gerenciam cronograma" on public.cronograma_aulas for all using (public.is_admin());
create policy "Alunos veem cronograma" on public.cronograma_aulas for select using (true);
grant select on public.cronograma_aulas to authenticated;
-- insert/update/delete pra authenticated (além do select já previsto): a
-- geração do cronograma (gerarCronogramaTurma) roda a partir da própria
-- Server Action de criar/editar turma, com o client autenticado do admin
-- (não service_role) — sem esses grants, a RLS "Admins gerenciam
-- cronograma" nem chega a ser avaliada, o Postgres barra antes por falta
-- de privilégio na tabela (mesmo caso já documentado no CLAUDE.md sobre
-- RLS não substituir grant).
grant insert, update, delete on public.cronograma_aulas to authenticated;
grant select, insert, update, delete on public.cronograma_aulas to service_role;
