-- Fase 10: certificados — critérios de aprovação configuráveis, template
-- único da escola, emissão automática (EAD) ou manual (presencial/híbrido).

alter table public.cursos
  add column carga_horaria_horas integer check (carga_horaria_horas > 0);

grant insert (carga_horaria_horas) on public.cursos to authenticated;
grant update (carga_horaria_horas) on public.cursos to authenticated;

alter table public.configuracoes
  add column certificado_nota_minima_percentual integer not null default 75
    check (certificado_nota_minima_percentual between 0 and 100),
  add column certificado_frequencia_minima_percentual integer not null default 75
    check (certificado_frequencia_minima_percentual between 0 and 100);

grant update (
  certificado_nota_minima_percentual,
  certificado_frequencia_minima_percentual,
  updated_by
) on public.configuracoes to authenticated;

create type public.certificado_status as enum ('pendente_emissao', 'emitido');
create type public.certificado_logo_posicao as enum (
  'topo_centro', 'superior_esquerdo', 'superior_direito', 'sem_logo'
);
create type public.certificado_logo_tamanho as enum ('pequeno', 'medio', 'grande');

-- Template único da escola (padrão singleton, igual configuracoes).
create table public.certificado_template (
  id boolean primary key default true,
  constraint certificado_template_singleton check (id),
  fundo_url text,
  logo_url text,
  logo_posicao public.certificado_logo_posicao not null default 'sem_logo',
  logo_tamanho public.certificado_logo_tamanho not null default 'medio',
  texto_principal text not null default
    'Certificamos que **{nome_aluno}** concluiu com aproveitamento o curso **{nome_curso}**, com carga horária de {carga_horaria}, concluído em {data_conclusao}.',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.certificado_template (id) values (true);

alter table public.certificado_template enable row level security;

create policy "Admins podem ver template de certificado"
  on public.certificado_template for select using (public.is_admin());

create policy "Admins podem atualizar template de certificado"
  on public.certificado_template for update using (public.is_admin()) with check (public.is_admin());

grant select on public.certificado_template to authenticated;
grant update (
  fundo_url, logo_url, logo_posicao, logo_tamanho, texto_principal, updated_by
) on public.certificado_template to authenticated;
grant select, insert, update, delete on public.certificado_template to service_role;

-- Ledger de certificados: um por matrícula.
create table public.certificados (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  status public.certificado_status not null default 'pendente_emissao',
  nota_minima_obtida_percentual integer,
  frequencia_percentual integer,
  carga_horaria_horas integer,
  arquivo_url text,
  emitido_em timestamptz,
  emitido_por uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificados_matricula_uidx unique (matricula_id)
);

create index certificados_status_idx on public.certificados (status);

alter table public.certificados enable row level security;

create policy "Alunos podem ver os proprios certificados emitidos"
  on public.certificados for select
  using (
    status = 'emitido'
    and exists (
      select 1 from public.matriculas m
      where m.id = certificados.matricula_id and m.aluno_id = auth.uid()
    )
  );

create policy "Admins podem ver todos os certificados"
  on public.certificados for select using (public.is_admin());

create policy "Admins podem atualizar certificados"
  on public.certificados for update using (public.is_admin()) with check (public.is_admin());

-- Sem grant de insert/delete pra authenticated: só a function abaixo
-- (security definer) cria linha — mesmo padrão de resgates/pontos_eventos.
grant select on public.certificados to authenticated;
grant update (status, arquivo_url, emitido_em, emitido_por, updated_at)
  on public.certificados to authenticated;
grant select, insert, update, delete on public.certificados to service_role;

-- Checagem de critérios: dispara em qualquer gravação relevante
-- (conclusão de aula, tentativa de prova, presença) sem precisar
-- tocar nas RPCs de gamificação já existentes.
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
  v_carga_horaria integer;
begin
  select m.status, t.curso_id, c.tipo, c.carga_horaria_horas
    into v_matricula_status, v_curso_id, v_curso_tipo, v_carga_horaria
  from public.matriculas m
  join public.turmas t on t.id = m.turma_id
  join public.cursos c on c.id = t.curso_id
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

  select min(melhor_nota) into v_nota_obtida
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
    matricula_id, status, nota_minima_obtida_percentual,
    frequencia_percentual, carga_horaria_horas, created_by
  ) values (
    p_matricula_id, 'pendente_emissao', v_nota_obtida,
    v_frequencia_percentual, v_carga_horaria, auth.uid()
  );
end;
$$;

create or replace function public.trg_avaliar_certificado_aula_concluida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.avaliar_certificado(new.matricula_id);
  return new;
end;
$$;

create trigger avaliar_certificado_on_aula_concluida
  after insert on public.aulas_concluidas
  for each row execute function public.trg_avaliar_certificado_aula_concluida();

create or replace function public.trg_avaliar_certificado_tentativa_prova()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.avaliar_certificado(new.matricula_id);
  return new;
end;
$$;

create trigger avaliar_certificado_on_tentativa_prova
  after insert on public.tentativas_prova
  for each row execute function public.trg_avaliar_certificado_tentativa_prova();

create or replace function public.trg_avaliar_certificado_presenca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.avaliar_certificado(new.matricula_id);
  return new;
end;
$$;

create trigger avaliar_certificado_on_presenca
  after insert or update on public.presencas
  for each row execute function public.trg_avaliar_certificado_presenca();

-- Bucket público: imagem de fundo e logo do template, mesmo padrão de
-- cursos/modulos (admin escreve, leitura via URL pública direta).
insert into storage.buckets (id, name, public) values ('certificado-template', 'certificado-template', true);

create policy "Admins podem enviar assets do template de certificado"
  on storage.objects for insert
  with check (bucket_id = 'certificado-template' and public.is_admin());

create policy "Admins podem atualizar assets do template de certificado"
  on storage.objects for update
  using (bucket_id = 'certificado-template' and public.is_admin());

create policy "Admins podem excluir assets do template de certificado"
  on storage.objects for delete
  using (bucket_id = 'certificado-template' and public.is_admin());

-- Bucket privado: PDF é documento pessoal do aluno, acesso só via signed
-- URL gerada no servidor com o client admin (mesmo padrão de materiais).
insert into storage.buckets (id, name, public) values ('certificados', 'certificados', false);

create policy "Admins podem enviar certificados"
  on storage.objects for insert
  with check (bucket_id = 'certificados' and public.is_admin());

create policy "Admins podem atualizar certificados no storage"
  on storage.objects for update
  using (bucket_id = 'certificados' and public.is_admin());

create policy "Admins podem excluir certificados no storage"
  on storage.objects for delete
  using (bucket_id = 'certificados' and public.is_admin());

-- Resolve a pendência já documentada no CLAUDE.md: geração de certificado
-- via client admin (service_role) precisa ler cursos/turmas/matriculas.
grant select, insert, update, delete on public.turmas to service_role;
grant select, insert, update, delete on public.cursos to service_role;
grant select, insert, update, delete on public.matriculas to service_role;
