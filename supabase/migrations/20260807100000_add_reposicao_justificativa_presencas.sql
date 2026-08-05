alter table public.presencas
  add column data_reposicao date,
  add column justificativa text;

alter table public.presencas
  add constraint presencas_reposicao_check check (
    (status = 'reposicao' and data_reposicao is not null)
    or (status <> 'reposicao' and data_reposicao is null)
  ),
  add constraint presencas_justificativa_check check (
    (status = 'justificada' and justificativa is not null and length(trim(justificativa)) > 0)
    or (status <> 'justificada' and justificativa is null)
  );

grant insert (data_reposicao, justificativa) on public.presencas to authenticated;
grant update (data_reposicao, justificativa) on public.presencas to authenticated;

-- Assinatura muda (2 parâmetros novos) — create or replace criaria um
-- overload em vez de substituir; precisa remover a versão antiga primeiro.
drop function public.upsert_presencas(uuid[], uuid, date, public.presenca_status[]);

create function public.upsert_presencas(
  p_matricula_ids uuid[],
  p_aula_id uuid,
  p_data date,
  p_statuses public.presenca_status[],
  p_data_reposicoes date[],
  p_justificativas text[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.presencas (matricula_id, aula_id, data, status, data_reposicao, justificativa)
  select matricula_id, p_aula_id, p_data, status, data_reposicao, justificativa
  from unnest(p_matricula_ids, p_statuses, p_data_reposicoes, p_justificativas)
    as t (matricula_id, status, data_reposicao, justificativa)
  on conflict (matricula_id, aula_id, data)
  do update set
    status = excluded.status,
    data_reposicao = excluded.data_reposicao,
    justificativa = excluded.justificativa;
$$;

grant execute on function public.upsert_presencas(
  uuid[], uuid, date, public.presenca_status[], date[], text[]
) to authenticated;
