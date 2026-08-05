create type public.presenca_status as enum ('presente', 'falta', 'justificada', 'reposicao');

create table public.presencas (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  aula_id uuid not null references public.aulas (id) on delete cascade,
  data date not null,
  status public.presenca_status not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Postgres não indexa FK automaticamente — sem isso, toda listagem por
-- matrícula ou por aula faria table scan.
create index presencas_matricula_id_idx on public.presencas (matricula_id);
create index presencas_aula_id_idx on public.presencas (aula_id);

-- Evita registrar a mesma matrícula, na mesma aula, na mesma data, duas
-- vezes — mas permite reposição em outra data (linha nova).
create unique index presencas_matricula_aula_data_uidx
  on public.presencas (matricula_id, aula_id, data);

alter table public.presencas enable row level security;

create policy "Admins podem ver presencas"
  on public.presencas for select using (public.is_admin());
create policy "Admins podem criar presencas"
  on public.presencas for insert with check (public.is_admin());
create policy "Admins podem atualizar presencas"
  on public.presencas for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins podem excluir presencas"
  on public.presencas for delete using (public.is_admin());

create trigger on_presencas_updated
  before update on public.presencas
  for each row execute function public.handle_updated_at();

grant select on public.presencas to authenticated;
grant insert (matricula_id, aula_id, data, status) on public.presencas to authenticated;
-- Só "status" é editável depois de criado — mesmo padrão de matriculas e do
-- e-mail de alunos. matricula_id/aula_id/data são imutáveis por grant, não
-- só por convenção da tela.
grant update (status) on public.presencas to authenticated;
grant delete on public.presencas to authenticated;

-- A chamada em lote precisa fazer upsert (insere quem é novo, atualiza só o
-- status de quem já tinha registro) num único round trip. O upsert genérico
-- do PostgREST reenvia TODAS as colunas do payload no "on conflict do
-- update", o que exigiria grant de update nas 4 colunas — abrindo mão da
-- imutabilidade acima. Esta function contorna isso: o "do update" só toca
-- em "status", então o grant de update (status) já basta.
-- security invoker (não definer): roda com o papel de quem chama, então RLS
-- (is_admin()) e os grants de coluna acima continuam valendo normalmente.
create function public.upsert_presencas(
  p_matricula_ids uuid[],
  p_aula_id uuid,
  p_data date,
  p_statuses public.presenca_status[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.presencas (matricula_id, aula_id, data, status)
  select matricula_id, p_aula_id, p_data, status
  from unnest(p_matricula_ids, p_statuses) as t (matricula_id, status)
  on conflict (matricula_id, aula_id, data)
  do update set status = excluded.status;
$$;

grant execute on function public.upsert_presencas(uuid[], uuid, date, public.presenca_status[])
  to authenticated;
