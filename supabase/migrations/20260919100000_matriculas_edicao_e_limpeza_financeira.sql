-- Edição completa da matrícula (aluno/turma), correção do gatilho de vagas e
-- limpeza atômica do financeiro de um aluno.
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

-- ===== 1. Gatilho de vagas: recalcula a turma ANTIGA quando a turma muda =====
--
-- A versão anterior (20260908200000_matriculas_campos_expandidos.sql) usava
-- COALESCE(NEW.turma_id, OLD.turma_id): num UPDATE isso é sempre a turma NOVA,
-- então trocar uma matrícula de turma deixava vagas_ocupadas da turma antiga
-- inflado (a vaga nunca voltava). Agora recalcula as duas.
create or replace function public.atualizar_vagas_turma()
returns trigger as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.turmas
    set vagas_ocupadas = (
      select count(*) from public.matriculas
      where turma_id = new.turma_id and status = 'ativa'
    )
    where id = new.turma_id;
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.turma_id is distinct from new.turma_id) then
    update public.turmas
    set vagas_ocupadas = (
      select count(*) from public.matriculas
      where turma_id = old.turma_id and status = 'ativa'
    )
    where id = old.turma_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ===== 2. Trocar aluno / turma de uma matrícula (atômico) =====
--
-- aluno_id e turma_id só tinham grant de INSERT em matriculas (o update era só
-- de status e dos campos financeiros) — daí esta função security definer, que
-- confere is_admin() e faz TUDO numa transação:
--   * troca aluno_id/turma_id na matrícula;
--   * se o ALUNO mudou, leva junto parcelas.aluno_id e contratos_assinados.aluno_id
--     (senão as parcelas ficariam no nome do aluno antigo).
--
-- TRAVA DE SEGURANÇA: se a matrícula já tem histórico acadêmico (presenças,
-- aulas concluídas, tentativas de quiz/prova, certificado, pontos), trocar o
-- ALUNO ou mudar pra uma turma de OUTRO CURSO misturaria o histórico de uma
-- pessoa/curso com outra(o). Nesses casos a função recusa e explica; trocar
-- pra outra turma do MESMO curso continua liberado.
create or replace function public.atualizar_vinculos_matricula(
  p_matricula_id uuid,
  p_aluno_id uuid,
  p_turma_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matricula public.matriculas%rowtype;
  v_curso_antigo uuid;
  v_curso_novo uuid;
  v_historico bigint := 0;
  v_qtd bigint;
  v_tabela text;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  select * into v_matricula from public.matriculas where id = p_matricula_id for update;
  if not found then
    raise exception 'Matrícula não encontrada.';
  end if;

  if v_matricula.aluno_id = p_aluno_id and v_matricula.turma_id = p_turma_id then
    return; -- nada mudou
  end if;

  select curso_id into v_curso_antigo from public.turmas where id = v_matricula.turma_id;
  select curso_id into v_curso_novo from public.turmas where id = p_turma_id;
  if v_curso_novo is null then
    raise exception 'Turma não encontrada.';
  end if;
  if not exists (select 1 from public.alunos where id = p_aluno_id) then
    raise exception 'Aluno não encontrado.';
  end if;

  -- Histórico acadêmico ligado à matrícula. to_regclass: se alguma dessas
  -- tabelas não existir neste banco, ela é simplesmente ignorada.
  foreach v_tabela in array array[
    'presencas', 'aulas_concluidas', 'tentativas_quiz', 'tentativas_prova',
    'certificados', 'pontos_eventos'
  ] loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('select count(*) from public.%I where matricula_id = $1', v_tabela)
        into v_qtd using p_matricula_id;
      v_historico := v_historico + v_qtd;
    end if;
  end loop;

  if v_historico > 0
     and (v_matricula.aluno_id <> p_aluno_id or v_curso_antigo is distinct from v_curso_novo) then
    raise exception
      'Esta matrícula já tem histórico acadêmico (% registro(s): presenças, aulas concluídas, provas, certificado ou pontos). Trocar o aluno ou mudar para outro curso misturaria esse histórico — cancele esta matrícula e crie uma nova.',
      v_historico;
  end if;

  -- Violação de unique (aluno_id, turma_id) sobe como 23505 pro app.
  update public.matriculas
  set aluno_id = p_aluno_id, turma_id = p_turma_id
  where id = p_matricula_id;

  if v_matricula.aluno_id <> p_aluno_id then
    update public.parcelas set aluno_id = p_aluno_id where matricula_id = p_matricula_id;
    update public.contratos_assinados set aluno_id = p_aluno_id where matricula_id = p_matricula_id;
  end if;
end;
$$;

revoke all on function public.atualizar_vinculos_matricula(uuid, uuid, uuid) from public, anon;
grant execute on function public.atualizar_vinculos_matricula(uuid, uuid, uuid) to authenticated;

-- ===== 3. Limpar TODO o financeiro de um aluno (atômico) =====
--
-- Apaga os pagamentos avulsos do aluno e depois as parcelas do aluno, na MESMA
-- transação (se uma etapa falhar, nada é apagado). A matrícula não é tocada.
-- Não há FK entre pagamentos_avulsos e parcelas — os dois se ligam ao aluno.
create or replace function public.limpar_financeiro_aluno(p_aluno_id uuid)
returns table (parcelas_excluidas integer, pagamentos_excluidos integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pagamentos integer;
  v_parcelas integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  delete from public.pagamentos_avulsos where aluno_id = p_aluno_id;
  get diagnostics v_pagamentos = row_count;

  delete from public.parcelas where aluno_id = p_aluno_id;
  get diagnostics v_parcelas = row_count;

  return query select v_parcelas, v_pagamentos;
end;
$$;

revoke all on function public.limpar_financeiro_aluno(uuid) from public, anon;
grant execute on function public.limpar_financeiro_aluno(uuid) to authenticated;
