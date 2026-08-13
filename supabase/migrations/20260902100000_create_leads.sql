-- CRM/Leads: captação de interessados, recontato via WhatsApp (Evolution
-- API já existente), e sincronização automática de status com a
-- realidade do aluno no sistema.

create type public.lead_origem as enum ('indicacao', 'redes_sociais', 'google', 'panfleto', 'outro');

-- novo/contatado: ainda não converteu. aluno_ativo/ex_aluno/desistente:
-- sincronizados automaticamente (ver triggers abaixo), nunca setados
-- manualmente pelo admin nesses três casos. descartado: só manual.
create type public.lead_status as enum (
  'novo', 'contatado', 'aluno_ativo', 'ex_aluno', 'desistente', 'descartado'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  curso_id uuid not null references public.cursos (id) on delete restrict,
  origem public.lead_origem not null,
  status public.lead_status not null default 'novo',
  observacoes text,
  -- Nullable: o formulário público grava via client admin (service_role),
  -- sem sessão autenticada por trás — mesma exceção documentada de
  -- mensagens_enviadas.created_by na Fase 13.
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_curso_id_idx on public.leads (curso_id);
create index leads_status_idx on public.leads (status);
create index leads_telefone_idx on public.leads (telefone);

create trigger on_leads_updated
  before update on public.leads
  for each row execute function public.handle_updated_at();

alter table public.leads enable row level security;

create policy "Admins podem ver leads"
  on public.leads for select using (public.is_admin());

create policy "Admins podem criar leads"
  on public.leads for insert with check (public.is_admin());

create policy "Admins podem atualizar leads"
  on public.leads for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins podem excluir leads"
  on public.leads for delete using (public.is_admin());

-- Sem policy/grant pra "anon": o formulário público não insere via RLS,
-- passa pelo client admin (service_role) na própria Server Action — ver
-- plano. service_role bypassa RLS mas precisa do grant de tabela abaixo.
grant select on public.leads to authenticated;
grant insert (nome, telefone, curso_id, origem, observacoes) on public.leads to authenticated;
grant update (status, observacoes, updated_at) on public.leads to authenticated;
grant delete on public.leads to authenticated;
grant select, insert, update, delete on public.leads to service_role;

-- ===== normalização de telefone em SQL (espelha normalizarTelefone em TS) =====

create or replace function public.normalizar_telefone(p_telefone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(p_telefone, '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(p_telefone, '\D', '', 'g')
    when length(regexp_replace(p_telefone, '\D', '', 'g')) in (12, 13)
      and regexp_replace(p_telefone, '\D', '', 'g') like '55%'
      then regexp_replace(p_telefone, '\D', '', 'g')
    else null
  end;
$$;

-- Dedup do formulário público: telefone (normalizado) + curso com lead
-- ainda "em aberto" (novo/contatado) não pode duplicar. A Server Action
-- tenta o insert e, no 23505, faz update no lead existente em vez de
-- criar linha nova — mesmo padrão de createMatricula com matriculas
-- (índice único parcial + catch do código de erro).
create unique index leads_telefone_curso_pendente_uidx
  on public.leads (public.normalizar_telefone(telefone), curso_id)
  where status in ('novo', 'contatado');

-- ===== sincronização de status (chamada pelas triggers abaixo) =====

create or replace function public.sincronizar_status_lead(
  p_telefone text,
  p_curso_id uuid,
  p_novo_status public.lead_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_telefone is null or p_curso_id is null then
    return;
  end if;

  update public.leads
  set status = p_novo_status
  where curso_id = p_curso_id
    and public.normalizar_telefone(telefone) = public.normalizar_telefone(p_telefone)
    and public.normalizar_telefone(p_telefone) is not null;
end;
$$;

-- ===== matriculas: aluno_ativo / desistente =====

create or replace function public.trg_sincronizar_lead_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_telefone text;
  v_curso_id uuid;
  v_status_mudou boolean;
begin
  if tg_op = 'INSERT' then
    v_status_mudou := true;
  else
    v_status_mudou := old.status is distinct from new.status;
  end if;

  if not v_status_mudou then
    return new;
  end if;

  select telefone into v_telefone from public.alunos where id = new.aluno_id;
  select curso_id into v_curso_id from public.turmas where id = new.turma_id;

  if new.status = 'ativa' then
    perform public.sincronizar_status_lead(v_telefone, v_curso_id, 'aluno_ativo');
  elsif new.status = 'cancelada' then
    perform public.sincronizar_status_lead(v_telefone, v_curso_id, 'desistente');
  end if;

  return new;
end;
$$;

create trigger sincronizar_lead_on_matricula
  after insert or update of status on public.matriculas
  for each row execute function public.trg_sincronizar_lead_matricula();

-- ===== avaliar_certificado: ex_aluno (curso concluído) =====
-- Corpo completo reproduzido (Postgres não permite alterar função por
-- partes) — idêntico ao da Fase 10/expansão, só com v_telefone
-- adicionado ao select inicial e a chamada de sincronização no final.

create or replace function public.avaliar_certificado(p_matricula_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso_id uuid;
  v_curso_tipo public.curso_tipo;
  v_matricula_status public.matricula_status;
  v_total_aulas integer;
  v_aulas_concluidas integer;
  v_nota_minima integer;
  v_frequencia_minima integer;
  v_provas_ok boolean;
  v_total_presencas integer;
  v_presentes integer;
  v_frequencia_percentual integer;
  v_nota_obtida integer;
  v_aproveitamento integer;
  v_carga_horaria integer;
  v_telefone text;
begin
  select m.status, t.curso_id, c.tipo, c.carga_horaria_horas, al.telefone
    into v_matricula_status, v_curso_id, v_curso_tipo, v_carga_horaria, v_telefone
  from public.matriculas m
  join public.turmas t on t.id = m.turma_id
  join public.cursos c on c.id = t.curso_id
  join public.alunos al on al.id = m.aluno_id
  where m.id = p_matricula_id;

  if v_curso_id is null or v_matricula_status not in ('ativa', 'concluida') then
    return;
  end if;

  if exists (select 1 from public.certificados where matricula_id = p_matricula_id) then
    return;
  end if;

  select count(*) into v_total_aulas
  from public.aulas a
  join public.modulos m on m.id = a.modulo_id
  where m.curso_id = v_curso_id;

  select count(distinct ac.aula_id) into v_aulas_concluidas
  from public.aulas_concluidas ac
  join public.aulas a on a.id = ac.aula_id
  join public.modulos m on m.id = a.modulo_id
  where m.curso_id = v_curso_id and ac.matricula_id = p_matricula_id;

  if v_total_aulas = 0 or v_aulas_concluidas < v_total_aulas then
    return;
  end if;

  select certificado_nota_minima_percentual, certificado_frequencia_minima_percentual
    into v_nota_minima, v_frequencia_minima
  from public.configuracoes where id = true;

  select not exists (
    select 1
    from public.provas p
    join public.modulos m on m.id = p.modulo_id
    where m.curso_id = v_curso_id
      and coalesce((
        select max(tp.nota) from public.tentativas_prova tp
        where tp.prova_id = p.id and tp.matricula_id = p_matricula_id
      ), -1) < v_nota_minima
  ) into v_provas_ok;

  if not v_provas_ok then
    return;
  end if;

  select min(melhor_nota), avg(melhor_nota)
    into v_nota_obtida, v_aproveitamento
  from (
    select p.id, max(tp.nota) as melhor_nota
    from public.provas p
    join public.modulos m on m.id = p.modulo_id
    left join public.tentativas_prova tp
      on tp.prova_id = p.id and tp.matricula_id = p_matricula_id
    where m.curso_id = v_curso_id
    group by p.id
  ) sub;

  v_frequencia_percentual := null;

  if v_curso_tipo <> 'ead' then
    select count(*), count(*) filter (where status in ('presente', 'reposicao', 'justificada'))
      into v_total_presencas, v_presentes
    from public.presencas pr
    join public.aulas a on a.id = pr.aula_id
    join public.modulos m on m.id = a.modulo_id
    where m.curso_id = v_curso_id and pr.matricula_id = p_matricula_id;

    if coalesce(v_total_presencas, 0) = 0 then
      return;
    end if;

    v_frequencia_percentual := round((v_presentes::numeric / v_total_presencas) * 100);

    if v_frequencia_percentual < v_frequencia_minima then
      return;
    end if;
  end if;

  insert into public.certificados (
    matricula_id, status, liberado, nota_minima_obtida_percentual,
    aproveitamento_percentual, frequencia_percentual, carga_horaria_horas, created_by
  ) values (
    p_matricula_id, 'pendente_emissao', (v_curso_tipo = 'ead'), v_nota_obtida,
    round(v_aproveitamento), v_frequencia_percentual, v_carga_horaria, auth.uid()
  );

  perform public.sincronizar_status_lead(v_telefone, v_curso_id, 'ex_aluno');
end;
$$;

-- ===== mensagens_enviadas (Fase 13): reaproveitado pra log de recontato =====

alter type public.mensagem_whatsapp_tipo add value 'lead_recontato';

alter table public.mensagens_enviadas alter column matricula_id drop not null;
alter table public.mensagens_enviadas add column lead_id uuid references public.leads (id) on delete cascade;
alter table public.mensagens_enviadas add constraint mensagens_enviadas_destino_check
  check ((matricula_id is not null) <> (lead_id is not null));

-- ===== whatsapp_config: 4º template =====

alter table public.whatsapp_config add column template_lead_recontato text not null default
  'Olá, {nome_lead}! Temos novidades sobre o curso {nome_curso}, turma {nome_turma}, com início em {data_inicio_turma}. Quer saber mais?';

grant select (template_lead_recontato) on public.whatsapp_config to authenticated;
grant update (template_lead_recontato) on public.whatsapp_config to authenticated;
