-- Fix: avaliar_certificado não gerava certificado pra curso sem nenhuma
-- prova cadastrada. O cálculo de nota_obtida/aproveitamento rodava uma
-- consulta de agregação sobre uma subquery vazia (sub sem linhas) — os
-- agregados min()/avg() já deveriam retornar null nesse caso (semântica
-- padrão de SQL), mas isso não estava acontecendo de forma confiável.
-- Corrigido isolando esse cálculo numa branch própria: sem provas, os
-- valores são setados null diretamente, sem rodar a consulta de
-- agregação — elimina qualquer ambiguidade na avaliação da subquery
-- vazia. null nesses dois campos é um valor válido em certificados
-- (nota_minima_obtida_percentual e aproveitamento_percentual não são
-- not null) e nunca deve impedir o insert.

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

  -- Curso sem provas cadastradas: nota_obtida/aproveitamento ficam null
  -- diretamente, sem rodar a agregação sobre uma subquery vazia.
  if exists (
    select 1 from public.provas p
    join public.modulos m on m.id = p.modulo_id
    where m.curso_id = v_curso_id
  ) then
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
  else
    v_nota_obtida := null;
    v_aproveitamento := null;
  end if;

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
    case when v_aproveitamento is null then null else round(v_aproveitamento) end,
    v_frequencia_percentual, v_carga_horaria, auth.uid()
  );

  perform public.sincronizar_status_lead(v_telefone, v_curso_id, 'ex_aluno');
end;
$$;
