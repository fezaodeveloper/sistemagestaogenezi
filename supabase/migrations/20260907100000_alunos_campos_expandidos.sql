-- Expande alunos com endereço detalhado (preparação para autocomplete via
-- ViaCEP — por isso "estado" fica sem CHECK, preenchido automaticamente),
-- vínculo opcional com auth.users e status do aluno; e responsaveis com
-- email/complemento. Só ADD COLUMN sobre o que já existe desde a Fase 3
-- (create_alunos) — nenhum campo/tabela existente é recriado.

alter table public.alunos
  add column full_name text,
  add column cep text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column cidade text,
  add column estado text,
  add column observacoes text,
  add column status_aluno text not null default 'ativo'
    check (status_aluno in ('ativo', 'inativo', 'trancado', 'formado')),
  add column user_id uuid references auth.users (id) on delete set null;

create index alunos_status_aluno_idx on public.alunos (status_aluno);
create index alunos_full_name_idx on public.alunos (full_name);

alter table public.responsaveis
  add column email text,
  add column complemento text;

-- Aditivo aos grants da Fase 3 (create_alunos) — mesmo padrão: campos de
-- negócio ficam insert+update para authenticated; id/created_by/created_at/
-- updated_at continuam de fora do grant, como já era. select já é concedido
-- na tabela inteira (sem restrição de coluna), então cobre os campos novos
-- automaticamente. service_role também já tem select/insert/update/delete
-- amplos na tabela inteira (20260829100000) — sem necessidade de grant novo.
grant insert (full_name, cep, numero, complemento, bairro, cidade, estado, observacoes, status_aluno, user_id)
  on public.alunos to authenticated;
grant update (full_name, cep, numero, complemento, bairro, cidade, estado, observacoes, status_aluno, user_id)
  on public.alunos to authenticated;

-- Aditivo aos grants da Fase 3 — responsaveis nunca recebeu grant para
-- service_role em nenhuma migration, então não é replicado aqui.
grant insert (email, complemento) on public.responsaveis to authenticated;
grant update (email, complemento) on public.responsaveis to authenticated;
