-- Expansão da Fase 10: liberação separada da emissão (presencial/híbrido
-- passa a ser liberado pelo admin e emitido pelo próprio aluno), template
-- frente/verso com editor WYSIWYG, assinatura, e variáveis novas.

-- ===== certificados: liberação separada da emissão =====

alter table public.certificados add column liberado boolean not null default false;
alter table public.certificados add column aproveitamento_percentual integer;

grant update (liberado) on public.certificados to authenticated;

create index certificados_liberado_idx on public.certificados (liberado) where liberado = false;

-- Aluno passa a ver a própria linha em qualquer status/liberado (precisa
-- pra renderizar "aguardando liberação" / "emitir" / "baixar" — antes só
-- via quando já estava emitido).
drop policy "Alunos podem ver os proprios certificados emitidos" on public.certificados;

create policy "Alunos podem ver os proprios certificados"
  on public.certificados for select
  using (
    exists (
      select 1 from public.matriculas m
      where m.id = certificados.matricula_id and m.aluno_id = auth.uid()
    )
  );

-- avaliar_certificado precisa decidir "liberado" na hora de criar a linha
-- (true automático só pra EAD) e agora também calcula o aproveitamento —
-- corpo muda, então é create or replace da function inteira (não dá pra
-- "alterar" função por partes em Postgres); a tabela em si não é recriada.
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

  -- v_nota_obtida = pior desempenho entre as provas (o que decidiu o
  -- critério); v_aproveitamento = média das melhores notas por prova
  -- (o que aparece no certificado como {aproveitamento}).
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
end;
$$;

-- ===== certificado_template: frente/verso, assinatura, cidade/estado =====

alter table public.certificado_template rename column fundo_url to fundo_frente_url;
alter table public.certificado_template add column fundo_verso_url text;

-- texto_principal era texto plano com **marcação**; o editor WYSIWYG grava
-- documento estruturado (JSON do Tiptap), formato incompatível — descarto
-- a coluna antiga (só tinha o texto padrão, nunca customizado de verdade)
-- em vez de tentar converter, e já entra nomeada pro par frente/verso.
alter table public.certificado_template drop column texto_principal;
alter table public.certificado_template add column texto_frente jsonb not null default
  '{"type":"doc","content":[{"type":"paragraph","content":[
    {"type":"text","text":"Certificamos que "},
    {"type":"text","marks":[{"type":"bold"}],"text":"{nome_aluno}"},
    {"type":"text","text":" concluiu com aproveitamento o curso "},
    {"type":"text","marks":[{"type":"bold"}],"text":"{nome_curso}"},
    {"type":"text","text":", com carga horária de {carga_horaria}, concluído em {data_conclusao}."}
  ]}]}'::jsonb;
alter table public.certificado_template add column texto_verso jsonb not null default
  '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb;

alter table public.certificado_template add column assinatura_url text;
alter table public.certificado_template add column cidade_emissao text;
alter table public.certificado_template add column estado_emissao text;

grant update (
  fundo_verso_url, texto_frente, texto_verso, assinatura_url, cidade_emissao, estado_emissao
) on public.certificado_template to authenticated;
