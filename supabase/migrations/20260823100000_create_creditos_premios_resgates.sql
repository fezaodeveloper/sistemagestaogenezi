-- Fase 9: Créditos educacionais — derivados dos pontos de gamificação
-- (pontos_eventos), gastáveis em cursos bônus (reaproveitando cursos +
-- matriculas) ou prêmios físicos (catálogo novo + fila de entrega).

-- ============================================================
-- CONFIGURAÇÃO: limite de cursos bônus por aluno (mesma tabela
-- singleton do toggle EAD da Fase 8 — extensível sem nova tabela).
-- ============================================================

alter table public.configuracoes
  add column max_cursos_bonus_por_aluno integer not null default 1
  constraint configuracoes_max_cursos_bonus_check check (max_cursos_bonus_por_aluno > 0);

grant update (max_cursos_bonus_por_aluno) on public.configuracoes to authenticated;

-- ============================================================
-- CURSOS: dois campos novos pra virar "curso bônus" resgatável.
-- ============================================================

alter table public.cursos
  add column disponivel_para_resgate boolean not null default false,
  add column custo_creditos integer;

alter table public.cursos
  add constraint cursos_custo_creditos_check check (
    (not disponivel_para_resgate) or (custo_creditos is not null and custo_creditos > 0)
  );

-- Só no grant de update (não no de insert) — resgatabilidade é decidida
-- depois de o curso já existir, no formulário de edição, não na criação.
grant update (disponivel_para_resgate, custo_creditos) on public.cursos to authenticated;

-- Sem isso, um curso bônus fica invisível pro aluno no catálogo de
-- resgate: a policy existente ("Alunos podem ver cursos em que estão
-- matriculados") só cobre cursos que ele JÁ cursa — um curso bônus, por
-- definição, ainda não tem matrícula dele.
create policy "Alunos podem ver cursos disponiveis para resgate"
  on public.cursos for select using (disponivel_para_resgate = true);

-- ============================================================
-- PRÊMIOS: catálogo de itens físicos resgatáveis.
-- ============================================================

create table public.premios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  foto_url text,
  custo_creditos integer not null check (custo_creditos > 0),
  estoque integer check (estoque is null or estoque >= 0), -- null = ilimitado
  ativo boolean not null default true,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premios enable row level security;

create policy "Admins podem ver todos os premios"
  on public.premios for select using (public.is_admin());

create policy "Alunos podem ver premios ativos"
  on public.premios for select using (ativo = true);

create policy "Admins podem criar premios"
  on public.premios for insert with check (public.is_admin());

create policy "Admins podem atualizar premios"
  on public.premios for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir premios"
  on public.premios for delete using (public.is_admin());

create trigger on_premios_updated
  before update on public.premios
  for each row execute function public.handle_updated_at();

grant select on public.premios to authenticated;
grant insert (nome, descricao, foto_url, custo_creditos, estoque, ativo) on public.premios to authenticated;
grant update (nome, descricao, foto_url, custo_creditos, estoque, ativo) on public.premios to authenticated;
grant delete on public.premios to authenticated;

-- ============================================================
-- RESGATES: ledger unificado (curso bônus + prêmio físico).
-- Zero grant de insert — só as functions abaixo escrevem.
-- ============================================================

create type public.resgate_tipo as enum ('curso_bonus', 'premio_fisico');
create type public.resgate_status as enum ('pendente', 'entregue', 'concluido');

create table public.resgates (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.resgate_tipo not null,
  -- Congelados no momento do resgate (mesmo princípio de nota/pontos em
  -- pontos_eventos) — se o admin excluir o curso/prêmio depois (curso_id/
  -- premio_id viram null via "on delete set null"), o histórico não perde
  -- o nome do item nem o valor pago.
  item_nome text not null,
  custo_creditos integer not null check (custo_creditos > 0),
  curso_id uuid references public.cursos (id) on delete set null,
  matricula_criada_id uuid references public.matriculas (id) on delete set null,
  premio_id uuid references public.premios (id) on delete set null,
  status public.resgate_status not null,
  entregue_em timestamptz,
  entregue_por uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  constraint resgates_tipo_campos_check check (
    (tipo = 'curso_bonus' and curso_id is not null and premio_id is null and status = 'concluido')
    or
    (tipo = 'premio_fisico' and premio_id is not null and curso_id is null and status in ('pendente', 'entregue'))
  )
);

create index resgates_aluno_id_idx on public.resgates (aluno_id);
create index resgates_tipo_idx on public.resgates (tipo);
create index resgates_status_idx on public.resgates (status);

alter table public.resgates enable row level security;

create policy "Admins podem ver todos os resgates"
  on public.resgates for select using (public.is_admin());

create policy "Alunos podem ver seus próprios resgates"
  on public.resgates for select using (aluno_id = auth.uid());

create policy "Admins podem atualizar status de resgates"
  on public.resgates for update using (public.is_admin()) with check (public.is_admin());

grant select on public.resgates to authenticated;
grant update (status, entregue_em, entregue_por) on public.resgates to authenticated;

-- ============================================================
-- SALDO: view derivada (nunca armazenada). security_invoker=true de
-- propósito — ao contrário de ranking_geral (deliberadamente pública),
-- créditos são informação pessoal: cada aluno só vê a própria linha via
-- RLS de profiles/pontos_eventos/resgates; admin vê todas.
-- ============================================================

create view public.creditos_saldo
with (security_invoker = true) as
select
  p.id as aluno_id,
  coalesce(pontos.total, 0) as pontos_totais,
  floor(coalesce(pontos.total, 0) / 50) as creditos_ganhos,
  coalesce(gastos.total, 0) as creditos_gastos,
  floor(coalesce(pontos.total, 0) / 50) - coalesce(gastos.total, 0) as creditos_disponiveis
from public.profiles p
left join (
  select m.aluno_id, sum(pe.pontos) as total
  from public.pontos_eventos pe
  join public.matriculas m on m.id = pe.matricula_id
  group by m.aluno_id
) pontos on pontos.aluno_id = p.id
left join (
  select r.aluno_id, sum(r.custo_creditos) as total
  from public.resgates r
  group by r.aluno_id
) gastos on gastos.aluno_id = p.id
where p.role = 'aluno';

grant select on public.creditos_saldo to authenticated;

-- ============================================================
-- RESGATE DE CURSO BÔNUS: cria a matrícula (reaproveitando o modelo
-- existente) + a linha do ledger, tudo atômico. security definer:
-- resgates/matriculas não têm grant de insert pra authenticated.
-- ============================================================

create function public.resgatar_curso_bonus(p_curso_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_disponivel boolean;
  v_nome text;
  v_custo integer;
  v_max integer;
  v_ja_resgatados integer;
  v_saldo integer;
  v_turma_id uuid;
  v_matricula_id uuid;
  v_resgate_id uuid;
begin
  -- Serializa qualquer resgate concorrente do MESMO aluno (dois cliques,
  -- duas abas) — evita gastar créditos que só existem uma vez.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text)::bigint);

  select disponivel_para_resgate, custo_creditos, nome into v_disponivel, v_custo, v_nome
  from public.cursos where id = p_curso_id;

  if not found or not v_disponivel then
    raise exception 'Este curso não está disponível para resgate.';
  end if;

  select max_cursos_bonus_por_aluno into v_max from public.configuracoes;

  select count(*) into v_ja_resgatados
  from public.resgates
  where aluno_id = auth.uid() and tipo = 'curso_bonus';

  if v_ja_resgatados >= v_max then
    raise exception 'Você já atingiu o limite de % curso(s) bônus resgatável(is).', v_max;
  end if;

  select creditos_disponiveis into v_saldo
  from public.creditos_saldo
  where aluno_id = auth.uid();

  if coalesce(v_saldo, 0) < v_custo then
    raise exception 'Créditos insuficientes para este resgate.';
  end if;

  select id into v_turma_id
  from public.turmas
  where curso_id = p_curso_id and status = 'ativa'
  order by data_inicio desc
  limit 1;

  if v_turma_id is null then
    raise exception 'Não há turma ativa disponível para este curso no momento. Fale com a administração.';
  end if;

  if exists (
    select 1 from public.matriculas
    where aluno_id = auth.uid() and turma_id = v_turma_id and status = 'ativa'
  ) then
    raise exception 'Você já está matriculado neste curso.';
  end if;

  insert into public.matriculas (aluno_id, turma_id, status)
  values (auth.uid(), v_turma_id, 'ativa')
  returning id into v_matricula_id;

  insert into public.resgates (aluno_id, tipo, item_nome, custo_creditos, curso_id, matricula_criada_id, status)
  values (auth.uid(), 'curso_bonus', v_nome, v_custo, p_curso_id, v_matricula_id, 'concluido')
  returning id into v_resgate_id;

  return v_resgate_id;
end;
$$;

grant execute on function public.resgatar_curso_bonus(uuid) to authenticated;

-- ============================================================
-- RESGATE DE PRÊMIO FÍSICO: decrementa estoque (se houver) + grava o
-- ledger como 'pendente' (entrega manual pelo admin depois).
-- ============================================================

create function public.resgatar_premio_fisico(p_premio_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativo boolean;
  v_nome text;
  v_custo integer;
  v_estoque integer;
  v_saldo integer;
  v_resgate_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text)::bigint);

  -- for update: trava a linha do prêmio até o fim da transação, pra dois
  -- ALUNOS DIFERENTES não conseguirem ler o mesmo estoque "1" ao mesmo
  -- tempo e ambos decrementarem pra 0.
  select ativo, nome, custo_creditos, estoque into v_ativo, v_nome, v_custo, v_estoque
  from public.premios where id = p_premio_id
  for update;

  if not found or not v_ativo then
    raise exception 'Este prêmio não está disponível.';
  end if;

  if v_estoque is not null and v_estoque <= 0 then
    raise exception 'Este prêmio está fora de estoque.';
  end if;

  select creditos_disponiveis into v_saldo
  from public.creditos_saldo
  where aluno_id = auth.uid();

  if coalesce(v_saldo, 0) < v_custo then
    raise exception 'Créditos insuficientes para este resgate.';
  end if;

  if v_estoque is not null then
    update public.premios set estoque = estoque - 1 where id = p_premio_id;
  end if;

  insert into public.resgates (aluno_id, tipo, item_nome, custo_creditos, premio_id, status)
  values (auth.uid(), 'premio_fisico', v_nome, v_custo, p_premio_id, 'pendente')
  returning id into v_resgate_id;

  return v_resgate_id;
end;
$$;

grant execute on function public.resgatar_premio_fisico(uuid) to authenticated;

-- ============================================================
-- Storage: bucket público para fotos de prêmio (catálogo, não conteúdo
-- protegido — diferente de "materiais" — serve a foto via URL pública
-- direta, sem signed URL). Upload/gestão do arquivo continua só admin.
-- ============================================================

insert into storage.buckets (id, name, public) values ('premios', 'premios', true);

create policy "Admins podem enviar fotos de premios"
  on storage.objects for insert
  with check (bucket_id = 'premios' and public.is_admin());
create policy "Admins podem atualizar fotos de premios"
  on storage.objects for update
  using (bucket_id = 'premios' and public.is_admin());
create policy "Admins podem excluir fotos de premios"
  on storage.objects for delete
  using (bucket_id = 'premios' and public.is_admin());
