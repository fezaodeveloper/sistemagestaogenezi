-- Hardening da policy de INSERT de aula_avaliacoes (20260924100000): ela referencia
-- public.aluno_acessa_aula(aula_id), criada em aula_comentarios (20260921100000). Se essa
-- migration ainda não tiver sido aplicada quando a de aula_avaliacoes rodar (migrations fora de
-- ordem), o "create policy" falha com "function public.aluno_acessa_aula does not exist" — e como
-- é a própria migration que cria a tabela, a tabela toda nem chega a existir (o "insert falha
-- silenciosamente" citado no bug report é, na real, a migration inteira nunca tendo sido
-- aplicada com sucesso).
--
-- Este bloco detecta se a função existe: se sim, mantém a checagem completa (nota = negócio
-- original); se não, cai pra um fallback mais simples (só aluno_id = auth.uid(), sem validar se a
-- aula pertence a um curso do aluno) — pedido explícito da tarefa, pra nunca travar a migration
-- inteira por causa de uma dependência de outra feature.
--
-- Idempotente: pode rodar depois de 20260924100000 já aplicada (troca a policy) ou logo depois
-- dela na mesma sessão de "aplicar todas as migrations pendentes" (efeito é o mesmo).
--
-- NÃO APLICADA — aguardando revisão manual antes de rodar no banco.

do $$
begin
  drop policy if exists "Alunos avaliam aulas do proprio curso" on public.aula_avaliacoes;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'aluno_acessa_aula'
  ) then
    create policy "Alunos avaliam aulas do proprio curso"
      on public.aula_avaliacoes for insert
      with check (aluno_id = auth.uid() and public.aluno_acessa_aula(aula_id));
  else
    create policy "Alunos avaliam aulas do proprio curso"
      on public.aula_avaliacoes for insert
      with check (aluno_id = auth.uid());
  end if;
end $$;
