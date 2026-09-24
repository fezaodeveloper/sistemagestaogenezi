-- Avaliação de aulas com estrelas (1-5) pelo aluno, com comentário opcional.
--
-- Uma linha por (aula, aluno) — "unique" abaixo — porque a UI faz upsert: clicar numa estrela
-- salva na hora (sem botão) e, se o aluno já tinha avaliado, a mesma linha é atualizada em vez de
-- criar uma segunda. Só aparece pro aluno depois que ele conclui a aula (regra de UI, ver
-- src/components/aluno/aula-avaliacao.tsx) — não é reforçada aqui no banco porque a intenção é só
-- guiar o fluxo (pedir feedback no momento certo), não impedir uma avaliação tardia legítima se o
-- aluno desmarcar/remarcar a aula como concluída depois.
--
-- created_by + aluno_id parecem redundantes (sempre o mesmo valor na prática), mas seguem o
-- mesmo padrão já usado em aula_comentarios (20260921100000): aluno_id é o dado de negócio (quem
-- avaliou), created_by é a convenção padrão do projeto (CLAUDE.md) para toda tabela nova. Como
-- quem escreve aqui é um papel NÃO-admin (o aluno), created_by precisa de on delete cascade —
-- mesmo motivo do bug já corrigido em aulas_concluidas (20260814110000): sem isso, excluir um
-- aluno (deleteAluno em /admin/alunos) falharia com violação de FK.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

create table public.aula_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.aulas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  nota integer not null check (nota between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 500),
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aula_id, aluno_id)
);

-- Métricas do admin agregam por aula (média, distribuição, última avaliação) — índice cobre o
-- group by. aluno_id: RLS/consulta "minhas avaliações" e o join do dialog de detalhes.
create index aula_avaliacoes_aula_id_idx on public.aula_avaliacoes (aula_id);
create index aula_avaliacoes_aluno_id_idx on public.aula_avaliacoes (aluno_id);

create trigger on_aula_avaliacoes_updated
  before update on public.aula_avaliacoes
  for each row execute function public.handle_updated_at();

alter table public.aula_avaliacoes enable row level security;

-- SELECT
create policy "Admins veem todas as avaliacoes"
  on public.aula_avaliacoes for select
  using (public.is_admin());

create policy "Alunos veem as proprias avaliacoes"
  on public.aula_avaliacoes for select
  using (aluno_id = auth.uid());

-- INSERT: o próprio aluno, só em aula de curso ao qual ele tem acesso (mesma checagem de
-- aula_comentarios, via aluno_acessa_aula — evita avaliar aula de curso em que não está
-- matriculado).
create policy "Alunos avaliam aulas do proprio curso"
  on public.aula_avaliacoes for insert
  with check (aluno_id = auth.uid() and public.aluno_acessa_aula(aula_id));

-- UPDATE: só a própria avaliação (alterar nota/comentário depois de já ter avaliado).
create policy "Alunos alteram a propria avaliacao"
  on public.aula_avaliacoes for update
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid());

-- Sem policy nem grant de DELETE: não foi pedido — a UI só cria/altera (upsert), nunca remove.

grant select on public.aula_avaliacoes to authenticated;
-- created_by/created_at/updated_at ficam de fora: default (auth.uid()/now()) e trigger.
grant insert (aula_id, aluno_id, nota, comentario) on public.aula_avaliacoes to authenticated;
grant update (nota, comentario) on public.aula_avaliacoes to authenticated;

-- service_role: bypassa RLS mas não grants de tabela (CLAUDE.md) — usado pelo client admin
-- (src/lib/supabase/admin.ts) nas queries agregadas do painel de métricas.
grant select, insert, update on public.aula_avaliacoes to service_role;
